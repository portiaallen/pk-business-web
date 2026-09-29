import { randomBytes, createHash, createHmac } from "crypto";
import nodemailer from "nodemailer";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { AuditAction } from "@/generated/prisma/client";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Reset links always go to Portia's verified PK contact inbox. */
export const PASSWORD_RESET_RECIPIENT_EMAIL = "portiaallen40@gmail.com";

export const RESET_TOKEN_TTL_MINUTES = 30;
export const RESET_REQUEST_COOLDOWN_MINUTES = 10;
export const MIN_PASSWORD_LENGTH = 12;

/** Production origin used in reset links. */
export function getSiteOrigin(): string {
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return origin && origin.startsWith("https://")
    ? origin.replace(/\/$/, "")
    : "https://www.pkservices.business";
}

// ─── Token utilities ──────────────────────────────────────────────────────────

export function generateResetToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashResetToken(token: string): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (secret) {
    return createHmac("sha256", secret).update(token).digest("hex");
  }
  // Fail-safe: never silently weaken token hashing in production.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SECRET is required in production for password reset token hashing."
    );
  }
  return createHash("sha256").update(token).digest("hex");
}

// ─── Request flow ─────────────────────────────────────────────────────────────

export type ResetRequestResult = { accepted: boolean };

/**
 * Handle a forgot-password request. Always returns a generic result so the
 * response never reveals whether the account exists. Only ADMIN accounts
 * receive a reset email, delivered to the fixed PK contact inbox.
 */
export async function requestPasswordReset(
  email: string
): Promise<ResetRequestResult> {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || user.role !== "ADMIN" || user.status !== "ACTIVE") {
    return { accepted: true };
  }

  // 10-minute cooldown: skip silently if a recent token was just issued.
  const cooldownCutoff = new Date(
    Date.now() - RESET_REQUEST_COOLDOWN_MINUTES * 60 * 1000
  );
  const recent = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id, createdAt: { gt: cooldownCutoff } },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    return { accepted: true };
  }

  // Invalidate any previous unused tokens for this user.
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

  const token = generateResetToken();
  const expiresAt = new Date(
    Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000
  );

  const created = await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hashResetToken(token), expiresAt },
  });

  const resetUrl = `${getSiteOrigin()}/forgot-password?token=${encodeURIComponent(token)}`;

  // If the email cannot be sent, roll the token back so the user can retry
  // immediately (no cooldown penalty for a failed send). The response is the
  // same generic message either way.
  try {
    await sendResetEmail(resetUrl);
  } catch (error) {
    await prisma.passwordResetToken.delete({ where: { id: created.id } }).catch(() => {});
    if (process.env.NODE_ENV !== "production") {
      console.error("Password reset email failed:", error);
    }
    return { accepted: true };
  }

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: AuditAction.PASSWORD_RESET_REQUESTED,
      resource: "auth",
      resourceId: user.id,
      metadata: JSON.stringify({ recipient: PASSWORD_RESET_RECIPIENT_EMAIL }),
    },
  });

  return { accepted: true };
}

async function sendResetEmail(resetUrl: string): Promise<void> {
  const gmailUser =
    process.env.GMAIL_USER?.trim() || PASSWORD_RESET_RECIPIENT_EMAIL;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.trim();

  if (!gmailAppPassword) {
    throw new Error("GMAIL_APP_PASSWORD is not configured");
  }

  const text = [
    "PK Business Services — admin password reset",
    "",
    "A password reset was requested for the PK admin portal.",
    "Open the link below within 30 minutes to choose a new password:",
    "",
    resetUrl,
    "",
    "This link can be used once. If you did not request this, ignore this email.",
  ].join("\n");

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmailUser, pass: gmailAppPassword },
  });

  await transporter.sendMail({
    from: `PK Business Services <${gmailUser}>`,
    to: PASSWORD_RESET_RECIPIENT_EMAIL,
    subject: "PK admin password reset link",
    text,
  });
}

// ─── Confirm flow ─────────────────────────────────────────────────────────────

/**
 * Atomically consume a one-use reset token and set the new password.
 * Revokes all sessions and any remaining reset tokens for the user, and
 * writes the PASSWORD_RESET_COMPLETED audit entry — all in one transaction.
 */
export async function confirmPasswordReset(
  token: string,
  password: string
): Promise<void> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw ApiError.badRequest(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
    );
  }

  const tokenHash = hashResetToken(token);
  const now = new Date();
  const passwordHash = await bcrypt.hash(password, 12);

  // Everything happens in one interactive transaction: the token is consumed
  // only if the password update, session revocation, and audit all succeed.
  // If any step fails the whole transaction rolls back, so the link stays
  // usable instead of being burned by a partial failure.
  await prisma.$transaction(async (tx) => {
    // Atomic one-use consumption: only succeeds if unused and unexpired.
    const consumed = await tx.passwordResetToken.updateMany({
      where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });

    if (consumed.count !== 1) {
      throw ApiError.badRequest("Invalid or expired reset link");
    }

    const resetToken = await tx.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    if (!resetToken) {
      throw ApiError.badRequest("Invalid or expired reset link");
    }

    await tx.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });
    // Revoke every session for this user.
    await tx.session.deleteMany({ where: { userId: resetToken.userId } });
    // Revoke any other reset tokens for this user.
    await tx.passwordResetToken.deleteMany({
      where: { userId: resetToken.userId, id: { not: resetToken.id } },
    });
    await tx.auditLog.create({
      data: {
        actorId: resetToken.userId,
        action: AuditAction.PASSWORD_RESET_COMPLETED,
        resource: "auth",
        resourceId: resetToken.userId,
        metadata: JSON.stringify({ method: "self_service_reset" }),
      },
    });
  });
}
