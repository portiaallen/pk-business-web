import { prisma } from "@/lib/prisma";
import {
  getSessionUser,
  getSessionTokenFromRequest,
  hasRole,
  type SessionUser,
} from "@/lib/auth";
import { ApiError } from "@/lib/api-error";
import { deleteObject } from "@/lib/storage";

// ─── Guards & parsing ─────────────────────────────────────────────────────────

/**
 * ADMIN-only guard for destructive (hard-delete) endpoints. Hard deletes are
 * never available to STAFF — they are irreversible.
 */
export async function requireAdminForDelete(
  request: Request
): Promise<SessionUser> {
  const token = getSessionTokenFromRequest(request);
  const user = await getSessionUser(token);
  if (!user || !hasRole(user, "ADMIN")) throw ApiError.forbidden();
  return user;
}

/**
 * Parse a JSON DELETE body of shape { id: "..." } (fetch supports DELETE bodies).
 * Used by list-route delete endpoints.
 */
export async function readDeleteId(request: Request): Promise<string> {
  const body = (await request.json().catch(() => null)) as { id?: string } | null;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!id) throw ApiError.badRequest("id is required");
  return id;
}

// ─── Storage cleanup ──────────────────────────────────────────────────────────

/**
 * Best-effort storage cleanup AFTER a successful DB delete. Deleting files
 * first would leave DB rows pointing at missing objects if the delete failed;
 * deleting after only risks orphaned files (harmless, unlinked to any row).
 */
export async function deleteStorageObjects(keys: string[]): Promise<void> {
  await Promise.all(
    keys.map((key) =>
      deleteObject(key).catch(() => {
        // Already gone or storage hiccup — the DB row is authoritative.
      })
    )
  );
}

// ─── Request (engagement) hard delete ─────────────────────────────────────────

/**
 * Hard-delete a verification request. Child rows (documents, deliverables,
 * notes, messages, form submissions, document requests, time entries, QB
 * review, AI review) are removed by DB cascade; invoices/payments keep their
 * records via onDelete: SetNull.
 */
export async function deleteRequestCascade(requestId: string): Promise<string[]> {
  const [documents, deliverables] = await Promise.all([
    prisma.document.findMany({
      where: { requestId },
      select: { storageKey: true },
    }),
    prisma.deliverable.findMany({
      where: { requestId },
      select: { storageKey: true },
    }),
  ]);

  await prisma.verificationRequest.delete({ where: { id: requestId } });

  return [...documents, ...deliverables].map((d) => d.storageKey);
}

// ─── Client (tenant) hard delete ──────────────────────────────────────────────

export type ClientDeleteResult = {
  storageKeys: string[];
  removedUserEmails: string[];
  counts: {
    requests: number;
    invoices: number;
    documents: number;
    deliverables: number;
    members: number;
    usersDeleted: number;
  };
};

/**
 * Hard-delete a client tenant: its requests (and all cascaded children),
 * invoices, payments, memberships — plus the CLIENT-role user accounts that
 * belong ONLY to this tenant (mirrors POST /api/admin/clients, which creates
 * the owner user + tenant together).
 *
 * Safety rails:
 *  - Refuses when any payment has been recorded (financial records) — delete
 *    the payments first (they have their own guarded DELETE).
 *  - A member user is only deleted if they have no membership in another
 *    tenant AND have not authored content (notes, messages, time entries, QB
 *    reviews) on another tenant's requests — the schema cascades those, so
 *    deleting such a user would destroy other clients' data.
 */
export async function deleteClientCascade(
  clientId: string
): Promise<ClientDeleteResult> {
  const paymentCount = await prisma.payment.count({ where: { clientId } });
  if (paymentCount > 0) {
    throw ApiError.conflict(
      "This client has payments recorded. Delete the payments first (from the invoice detail pages) — financial records are never deleted silently."
    );
  }

  const members = await prisma.clientMember.findMany({
    where: { clientId },
    select: { user: { select: { id: true, email: true } } },
  });
  const memberUserIds = [...new Set(members.map((m) => m.user.id))];

  // Users that also belong to another tenant must be kept.
  const crossTenant = await prisma.clientMember.findMany({
    where: { clientId: { not: clientId }, userId: { in: memberUserIds } },
    select: { userId: true },
  });
  const crossTenantIds = new Set(crossTenant.map((c) => c.userId));

  // The schema cascades authored content (notes, messages, time entries, QB
  // reviews) on user delete — keep users who authored content elsewhere.
  const [foreignNoteAuthors, foreignMessageAuthors, foreignTimeUsers, foreignQbReviewers] =
    await Promise.all([
      prisma.internalNote.findMany({
        where: { authorId: { in: memberUserIds }, request: { clientId: { not: clientId } } },
        select: { authorId: true },
        distinct: ["authorId"],
      }),
      prisma.clientMessage.findMany({
        where: { authorId: { in: memberUserIds }, request: { clientId: { not: clientId } } },
        select: { authorId: true },
        distinct: ["authorId"],
      }),
      prisma.timeEntry.findMany({
        where: { userId: { in: memberUserIds }, request: { clientId: { not: clientId } } },
        select: { userId: true },
        distinct: ["userId"],
      }),
      prisma.qbCleanupReview.findMany({
        where: { reviewerId: { in: memberUserIds }, request: { clientId: { not: clientId } } },
        select: { reviewerId: true },
        distinct: ["reviewerId"],
      }),
    ]);

  const keepIds = new Set([
    ...crossTenantIds,
    ...foreignNoteAuthors.map((n) => n.authorId),
    ...foreignMessageAuthors.map((m) => m.authorId),
    ...foreignTimeUsers.map((t) => t.userId),
    ...foreignQbReviewers.map((q) => q.reviewerId),
  ]);
  const deletableUserIds = memberUserIds.filter((id) => !keepIds.has(id));

  const [documents, deliverables] = await Promise.all([
    prisma.document.findMany({
      where: { request: { clientId } },
      select: { storageKey: true },
    }),
    prisma.deliverable.findMany({
      where: { request: { clientId } },
      select: { storageKey: true },
    }),
  ]);

  const [requestCount, invoiceCount] = await Promise.all([
    prisma.verificationRequest.count({ where: { clientId } }),
    prisma.invoice.count({ where: { clientId } }),
  ]);

  const removedUsers =
    deletableUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: deletableUserIds } },
          select: { email: true },
        })
      : [];

  await prisma.$transaction([
    prisma.verificationRequest.deleteMany({ where: { clientId } }),
    prisma.invoice.deleteMany({ where: { clientId } }),
    prisma.clientMember.deleteMany({ where: { clientId } }),
    deletableUserIds.length > 0
      ? prisma.user.deleteMany({ where: { id: { in: deletableUserIds } } })
      : prisma.client.count({ where: { id: clientId } }), // no-op placeholder
    prisma.client.delete({ where: { id: clientId } }),
  ]);

  return {
    storageKeys: [...documents, ...deliverables].map((d) => d.storageKey),
    removedUserEmails: removedUsers.map((u) => u.email),
    counts: {
      requests: requestCount,
      invoices: invoiceCount,
      documents: documents.length,
      deliverables: deliverables.length,
      members: memberUserIds.length,
      usersDeleted: deletableUserIds.length,
    },
  };
}
