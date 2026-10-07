import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireStaff,
  requireCapability,
  CAPABILITIES,
  type Capability,
} from "@/lib/capabilities";
import { requireRecentAuthentication } from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api-error";
/** Security changes are atomic with audit, compare-and-swap and revocation. No self grants. */
export async function POST(request: Request) {
  try {
    const actor = await requireStaff(request);
    requireRecentAuthentication(actor);
    const body = await request.json();
    const capability =
      body.action === "assign"
        ? "assignments"
        : body.action === "grant" ||
            body.action === "revoke" ||
            body.action === "role"
          ? "permissions"
          : "security";
    await requireCapability(actor, capability);
    const reasons = [
      "APPROVED_ACCESS_CHANGE",
      "STAFF_OFFBOARDING",
      "CLIENT_ASSIGNMENT_CHANGE",
      "VERIFIED_MANUAL_RECOVERY",
      "AUTHORIZED_ENROLLMENT",
    ];
    if (process.env.PK_ENVIRONMENT === "test") reasons.push("SYNTHETIC_TEST");
    if (!reasons.includes(body.reason))
      throw ApiError.badRequest("Approved reason code required");
    if (
      body.action === "manual-recovery" &&
      (body.reason !== "VERIFIED_MANUAL_RECOVERY" ||
        body.identityProofApproved !== true)
    )
      throw ApiError.forbidden(
        "Complete the approved manual identity-proof procedure first",
      );
    if (
      typeof body.targetId !== "string" ||
      body.targetId === actor.id ||
      !Number.isInteger(body.expectedVersion) ||
      !/^[A-Z_]{3,64}$/.test(body.reason || "")
    )
      throw ApiError.badRequest(
        "Target, expected version and controlled reason code required; self changes prohibited",
      );
    if (
      ![
        "grant",
        "revoke",
        "offboard",
        "role",
        "enrollment",
        "manual-recovery",
        "assign",
      ].includes(body.action)
    )
      throw ApiError.badRequest();
    await prisma.$transaction(async (tx) => {
      const actorCurrent = await tx.user.findUniqueOrThrow({
        where: { id: actor.id },
      });
      const actorGrant = await tx.capabilityGrant.findFirst({
        where: { userId: actor.id, capability, scope: "GLOBAL", clientId: "" },
      });
      if (
        !actorGrant ||
        actorCurrent.status !== "ACTIVE" ||
        actorCurrent.securityVersion !== actor.securityVersion
      )
        throw ApiError.forbidden();
      const target = await tx.user.findUniqueOrThrow({
        where: { id: body.targetId },
      });
      if (target.role === "CLIENT" && body.action !== "offboard")
        throw ApiError.forbidden();
      const changed = await tx.user.updateMany({
        where: { id: target.id, securityVersion: body.expectedVersion },
        data: { securityVersion: { increment: 1 } },
      });
      if (changed.count !== 1)
        throw ApiError.conflict("Security state changed");
      let previousGrant = false;
      let previousAssignment: string | null = null;
      if (body.action === "grant" || body.action === "revoke") {
        if (
          !CAPABILITIES.includes(body.capability) ||
          !["GLOBAL", "CLIENT", "REQUEST"].includes(body.scope)
        )
          throw ApiError.badRequest();
        const global = [
          "permissions",
          "security",
          "audit",
          "pricing",
          "client_management",
          "consultations",
          "assignments",
        ].includes(body.capability);
        if (
          (global && body.scope !== "GLOBAL") ||
          (!global && !["CLIENT", "REQUEST"].includes(body.scope))
        )
          throw ApiError.badRequest("Invalid capability scope");
        const clientId = body.scope !== "GLOBAL" ? body.clientId : "";
        if (
          typeof clientId !== "string" ||
          (body.scope !== "GLOBAL" && !clientId)
        )
          throw ApiError.badRequest();
        if (
          clientId &&
          !(await tx.client.findFirst({
            where: { id: clientId, status: "ACTIVE" },
          }))
        )
          throw ApiError.forbidden();
        const requestId = body.scope === "REQUEST" ? body.requestId : "";
        if (
          typeof requestId !== "string" ||
          (body.scope === "REQUEST" && !requestId)
        )
          throw ApiError.badRequest();
        if (
          requestId &&
          !(await tx.verificationRequest.findFirst({
            where: { id: requestId, clientId },
          }))
        )
          throw ApiError.forbidden();
        const selector = {
          requestId,
          userId: target.id,
          capability: body.capability as Capability,
          scope: body.scope,
          clientId,
        };
        previousGrant = !!(await tx.capabilityGrant.findUnique({
          where: { userId_capability_scope_clientId_requestId: selector },
        }));
        if (body.action === "grant")
          await tx.capabilityGrant.upsert({
            where: { userId_capability_scope_clientId_requestId: selector },
            create: selector,
            update: {},
          });
        else await tx.capabilityGrant.deleteMany({ where: selector });
      }
      if (body.action === "role") {
        if (!["ADMIN", "STAFF"].includes(body.role))
          throw ApiError.badRequest();
        await tx.user.update({
          where: { id: target.id },
          data: { role: body.role },
        });
      }
      if (body.action === "assign") {
        if (typeof body.requestId !== "string" || target.status !== "ACTIVE")
          throw ApiError.badRequest();
        const engagement = await tx.verificationRequest.findUniqueOrThrow({
          where: { id: body.requestId },
        });
        if (
          !(await tx.client.findFirst({
            where: { id: engagement.clientId, status: "ACTIVE" },
          }))
        )
          throw ApiError.forbidden();
        previousAssignment = engagement.assignedStaffId;
        await tx.verificationRequest.update({
          where: { id: engagement.id },
          data: {
            assignedStaffId: body.clearAssignment === true ? null : target.id,
          },
        });
      }
      if (["enrollment", "manual-recovery"].includes(body.action)) {
        // Manual identity proof and approval must happen outside the app; reason code documents the approved procedure.
        await tx.user.update({
          where: { id: target.id },
          data: {
            mfaEnrollmentAllowed: true,
            mfaEnrollmentExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
          },
        });
        if (body.action === "manual-recovery") {
          await tx.webAuthnCredential.deleteMany({
            where: { userId: target.id },
          });
          await tx.recoveryCode.deleteMany({ where: { userId: target.id } });
        }
      }
      if (body.action === "offboard") {
        const revoked = await tx.capabilityGrant.findMany({
          where: { userId: target.id },
        });
        for (const grant of revoked)
          await tx.auditLog.create({
            data: {
              actorId: actor.id,
              action: "ADMIN_ACTION",
              resource: "permission",
              resourceId: target.id,
              metadata: JSON.stringify({
                action: "OFFBOARD_ACCESS_REVOKED",
                capability: CAPABILITIES.includes(
                  grant.capability as Capability,
                )
                  ? grant.capability
                  : undefined,
                scope: grant.scope,
                clientId: grant.clientId || undefined,
                requestId: grant.requestId || undefined,
                previousGrant: true,
                newGrant: false,
                reason: body.reason,
                assurance: actor.assurance,
              }),
            },
          });
        const assignments = await tx.verificationRequest.findMany({
          where: { assignedStaffId: target.id },
          select: { id: true, clientId: true },
        });
        for (const assignment of assignments)
          await tx.auditLog.create({
            data: {
              actorId: actor.id,
              clientId: assignment.clientId,
              action: "REQUEST_ASSIGNED",
              resource: "verification_request",
              resourceId: assignment.id,
              metadata: JSON.stringify({
                action: "OFFBOARD_ASSIGNMENT_REVOKED",
                previousAssignment: target.id,
                newAssignment: null,
                reason: body.reason,
                assurance: actor.assurance,
              }),
            },
          });
        await tx.user.update({
          where: { id: target.id },
          data: {
            status: "INACTIVE",
            mfaEnrollmentAllowed: false,
            mfaEnrollmentExpiresAt: null,
          },
        });
        await tx.capabilityGrant.deleteMany({ where: { userId: target.id } });
        await tx.clientMember.deleteMany({ where: { userId: target.id } });
        await tx.verificationRequest.updateMany({
          where: {
            assignedStaffId: body.clearAssignment === true ? null : target.id,
          },
          data: { assignedStaffId: null },
        });
        await tx.webAuthnCredential.deleteMany({
          where: { userId: target.id },
        });
        await tx.recoveryCode.deleteMany({ where: { userId: target.id } });
      }
      await tx.session.deleteMany({ where: { userId: target.id } });
      await tx.securityChallenge.deleteMany({ where: { userId: target.id } });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "ADMIN_ACTION",
          resource: "identity",
          resourceId: target.id,
          metadata: JSON.stringify({
            action: body.action.replaceAll("-", "_").toUpperCase(),
            reason: body.reason,
            capability: CAPABILITIES.includes(body.capability)
              ? body.capability
              : undefined,
            scope: ["GLOBAL", "CLIENT", "REQUEST"].includes(body.scope)
              ? body.scope
              : undefined,
            clientId:
              ["grant", "revoke"].includes(body.action) &&
              body.scope !== "GLOBAL"
                ? body.clientId
                : undefined,
            requestId:
              body.action === "assign" ||
              (["grant", "revoke"].includes(body.action) &&
                body.scope === "REQUEST")
                ? body.requestId
                : undefined,
            previousGrant,
            newGrant: body.action === "grant",
            previousAssignment,
            newAssignment:
              body.action === "assign"
                ? body.clearAssignment === true
                  ? null
                  : target.id
                : undefined,
            previousStatus: target.status,
            newStatus: body.action === "offboard" ? "INACTIVE" : target.status,
            previousRole: target.role,
            newRole: body.action === "role" ? body.role : target.role,
            previousVersion: target.securityVersion,
            newVersion: target.securityVersion + 1,
            assurance: actor.assurance,
          }),
        },
      });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: Request) {
  try {
    const actor = await requireStaff(request);
    const grants = await prisma.capabilityGrant.findMany({
      where: {
        userId: actor.id,
        scope: "GLOBAL",
        clientId: "",
        capability: { in: ["security", "permissions", "assignments"] },
      },
    });
    if (!grants.length) throw ApiError.forbidden();
    const id = new URL(request.url).searchParams.get("userId");
    if (!id) throw ApiError.badRequest();
    const target = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        role: true,
        status: true,
        securityVersion: true,
        capabilityGrants: true,
      },
    });
    if (!target) throw ApiError.notFound();
    return NextResponse.json(target);
  } catch (error) {
    return handleApiError(error);
  }
}
