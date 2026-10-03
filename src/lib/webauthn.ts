import { randomBytes, createHash } from "node:crypto";
import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransport,
} from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { createSession, hashToken } from "@/lib/auth";
import { securityEnvironment } from "@/lib/security-environment";

export function relyingParty() {
  const environment = securityEnvironment();
  const configured = process.env.PK_WEBAUTHN_ORIGIN;
  if (!configured && ["production", "preview"].includes(environment))
    throw new Error("WebAuthn origin must be configured");
  const url = new URL(configured || "http://localhost:4321");
  if (
    url.origin !== (configured || "http://localhost:4321") ||
    (url.protocol !== "https:" &&
      !(
        url.hostname === "localhost" &&
        ["development", "test"].includes(environment)
      ))
  )
    throw new Error("Invalid WebAuthn origin");
  return {
    origin: url.origin,
    rpID: url.hostname,
    rpName: "PK Business Services",
  };
}
export function recoveryHash(code: string): string {
  return createHash("sha256").update(`pk-recovery:${code}`).digest("hex");
}
export function challengeUsable(
  challenge: {
    consumedAt: Date | null;
    expiresAt: Date;
    securityVersion: number;
    user: { securityVersion: number; status: string };
  },
  now = new Date(),
) {
  return (
    !challenge.consumedAt &&
    challenge.expiresAt > now &&
    challenge.user.status === "ACTIVE" &&
    challenge.securityVersion === challenge.user.securityVersion
  );
}
export async function startChallenge(
  userId: string,
  purpose: "LOGIN" | "ENROLL" | "RECOVERY_ENROLL" | "STEP_UP",
  sessionId?: string,
  passwordVerifiedAt = new Date(),
) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { webauthnCredentials: true },
  });
  if (user.status !== "ACTIVE" || user.role === "CLIENT")
    throw ApiError.forbidden();
  if (
    purpose === "ENROLL" &&
    !user.webauthnCredentials.length &&
    (!user.mfaEnrollmentAllowed ||
      !user.mfaEnrollmentExpiresAt ||
      user.mfaEnrollmentExpiresAt <= new Date())
  )
    throw ApiError.forbidden(
      "Enrollment requires an authorized security administrator",
    );
  if (sessionId && purpose === "ENROLL") {
    const bound = await prisma.session.findUniqueOrThrow({
      where: { id: sessionId },
    });
    if (
      bound.userId !== userId ||
      bound.securityVersion !== user.securityVersion
    )
      throw ApiError.unauthorized();
    passwordVerifiedAt = bound.passwordVerifiedAt;
  }
  const rp = relyingParty();
  const credentials = user.webauthnCredentials.map((c) => ({
    id: c.id,
    transports: JSON.parse(c.transports) as AuthenticatorTransport[],
  }));
  const enrollment = purpose === "ENROLL" || purpose === "RECOVERY_ENROLL";
  const options = enrollment
    ? await generateRegistrationOptions({
        ...rp,
        userID: new TextEncoder().encode(user.id),
        userName: user.email,
        attestationType: "none",
        supportedAlgorithmIDs: [-7, -257],
        excludeCredentials: credentials,
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "required",
        },
      })
    : await generateAuthenticationOptions({
        rpID: rp.rpID,
        allowCredentials: credentials,
        userVerification: "required",
      });
  const ticket = randomBytes(32).toString("hex");
  await prisma.$transaction(async (tx) => {
    const fresh = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (
      fresh.securityVersion !== user.securityVersion ||
      fresh.status !== "ACTIVE"
    )
      throw ApiError.unauthorized();
    await tx.securityChallenge.deleteMany({
      where: {
        userId,
        OR: [{ expiresAt: { lte: new Date() } }, { consumedAt: { not: null } }],
      },
    });
    await tx.securityChallenge.create({
      data: {
        userId,
        tokenHash: hashToken(ticket),
        challenge: options.challenge,
        purpose,
        passwordVerifiedAt,
        sessionId,
        securityVersion: user.securityVersion,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: "ADMIN_ACTION",
        resource: "security",
        metadata: JSON.stringify({ action: "CHALLENGE_CREATED", purpose }),
      },
    });
  });
  return { ticket, options, enrollment };
}
export async function finishChallenge(
  ticket: string,
  response: RegistrationResponseJSON | AuthenticationResponseJSON,
  label = "Passkey",
) {
  if (!/^[a-f0-9]{64}$/.test(ticket)) throw ApiError.unauthorized();
  // Burn before cryptographic verification: even failed requests cannot replay the challenge.
  const challenge = await prisma.$transaction(async (tx) => {
    const c = await tx.securityChallenge.findUnique({
      where: { tokenHash: hashToken(ticket) },
      include: { user: true },
    });
    if (!c || !challengeUsable(c)) throw ApiError.unauthorized();
    const burned = await tx.securityChallenge.updateMany({
      where: { id: c.id, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    });
    if (burned.count !== 1) throw ApiError.unauthorized();
    await tx.auditLog.create({
      data: {
        actorId: c.userId,
        action: "ADMIN_ACTION",
        resource: "security",
        metadata: JSON.stringify({
          action: "CHALLENGE_CONSUMED",
          purpose: c.purpose,
        }),
      },
    });
    return c;
  });
  const rp = relyingParty();
  const enrollment = ["ENROLL", "RECOVERY_ENROLL"].includes(challenge.purpose);
  if (enrollment) {
    const result = await verifyRegistrationResponse({
      response: response as RegistrationResponseJSON,
      expectedChallenge: challenge.challenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.rpID,
      requireUserVerification: true,
    });
    if (!result.verified || !result.registrationInfo)
      throw ApiError.unauthorized();
    const info = result.registrationInfo;
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({
        where: { id: challenge.userId },
      });
      if (
        user.status !== "ACTIVE" ||
        user.securityVersion !== challenge.securityVersion
      )
        throw ApiError.unauthorized();
      if (
        challenge.purpose === "ENROLL" &&
        !challenge.sessionId &&
        (!user.mfaEnrollmentAllowed ||
          !user.mfaEnrollmentExpiresAt ||
          user.mfaEnrollmentExpiresAt <= new Date())
      )
        throw ApiError.forbidden();
      if (challenge.sessionId) {
        const bound = await tx.session.findFirst({
          where: {
            id: challenge.sessionId,
            userId: user.id,
            securityVersion: user.securityVersion,
            expiresAt: { gt: new Date() },
            assurance: "WEBAUTHN",
          },
        });
        if (!bound) throw ApiError.unauthorized();
      }
      await tx.webAuthnCredential.create({
        data: {
          id: info.credential.id,
          userId: user.id,
          publicKey: Buffer.from(info.credential.publicKey),
          counter: BigInt(info.credential.counter),
          transports: JSON.stringify(info.credential.transports || []),
          label: label.slice(0, 80),
          deviceType: info.credentialDeviceType,
          backedUp: info.credentialBackedUp,
        },
      });
      await tx.user.update({
        where: { id: user.id },
        data: { mfaEnrollmentAllowed: false, mfaEnrollmentExpiresAt: null },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "ADMIN_ACTION",
          resource: "security",
          metadata: JSON.stringify({ action: "AUTHENTICATOR_ENROLLED" }),
        },
      });
    });
  } else {
    const credential = await prisma.webAuthnCredential.findUnique({
      where: { id: response.id },
    });
    if (!credential || credential.userId !== challenge.userId)
      throw ApiError.unauthorized();
    const result = await verifyAuthenticationResponse({
      response: response as AuthenticationResponseJSON,
      expectedChallenge: challenge.challenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.rpID,
      requireUserVerification: true,
      credential: {
        id: credential.id,
        publicKey: new Uint8Array(credential.publicKey),
        counter: Number(credential.counter),
        transports: JSON.parse(credential.transports),
      },
    });
    if (!result.verified) throw ApiError.unauthorized();
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({
        where: { id: challenge.userId },
      });
      if (
        user.status !== "ACTIVE" ||
        user.securityVersion !== challenge.securityVersion
      )
        throw ApiError.unauthorized();
      const changed = await tx.webAuthnCredential.updateMany({
        where: { id: credential.id, counter: credential.counter },
        data: {
          counter: BigInt(result.authenticationInfo.newCounter),
          lastUsedAt: new Date(),
          backedUp: result.authenticationInfo.credentialBackedUp,
        },
      });
      if (changed.count !== 1) throw ApiError.unauthorized();
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "ADMIN_ACTION",
          resource: "security",
          metadata: JSON.stringify({ action: "MFA_VERIFIED" }),
        },
      });
    });
  }
  if (challenge.purpose === "STEP_UP") {
    const changed = await prisma.session.updateMany({
      where: {
        id: challenge.sessionId || "",
        userId: challenge.userId,
        securityVersion: challenge.securityVersion,
        expiresAt: { gt: new Date() },
      },
      data: {
        passwordVerifiedAt: challenge.passwordVerifiedAt,
        mfaVerifiedAt: new Date(),
      },
    });
    if (changed.count !== 1) throw ApiError.unauthorized();
    return { steppedUp: true };
  }
  // Additional authenticator enrollment does not create a separate privileged session.
  if (challenge.sessionId) return { enrolled: true };
  return {
    token: await createSession(
      challenge.userId,
      "WEBAUTHN",
      challenge.securityVersion,
      challenge.passwordVerifiedAt,
    ),
  };
}
export async function redeemRecovery(ticket: string, code: string) {
  if (!/^[a-f0-9]{64}$/.test(ticket) || !/^[a-f0-9]{48}$/.test(code))
    throw ApiError.unauthorized();
  const userId = await prisma.$transaction(async (tx) => {
    const c = await tx.securityChallenge.findUnique({
      where: { tokenHash: hashToken(ticket) },
      include: { user: true },
    });
    if (!c || c.purpose !== "LOGIN" || !challengeUsable(c))
      throw ApiError.unauthorized();
    const burned = await tx.securityChallenge.updateMany({
      where: { id: c.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (burned.count !== 1) throw ApiError.unauthorized();
    const codeRow = await tx.recoveryCode.updateMany({
      where: { userId: c.userId, codeHash: recoveryHash(code), usedAt: null },
      data: { usedAt: new Date() },
    });
    // Return failure so the burned attempt commits; audit failure still rolls back safely.
    await tx.auditLog.create({
      data: {
        actorId: c.userId,
        action: "ADMIN_ACTION",
        resource: "security",
        metadata: JSON.stringify({
          action:
            codeRow.count === 1 ? "RECOVERY_CODE_USED" : "RECOVERY_CODE_DENIED",
        }),
      },
    });
    if (codeRow.count !== 1) return null;
    await tx.user.update({
      where: { id: c.userId },
      data: { securityVersion: { increment: 1 } },
    });
    await tx.session.deleteMany({ where: { userId: c.userId } });
    // Treat lost-factor recovery as a security reset: old device credentials must not retain access.
    await tx.webAuthnCredential.deleteMany({ where: { userId: c.userId } });
    await tx.securityChallenge.deleteMany({ where: { userId: c.userId } });
    return { id: c.userId, passwordVerifiedAt: c.passwordVerifiedAt };
  });
  if (!userId) throw ApiError.unauthorized();
  // Restricted ticket grants enrollment only, not confidential access or a session.
  return startChallenge(
    userId.id,
    "RECOVERY_ENROLL",
    undefined,
    userId.passwordVerifiedAt,
  );
}
