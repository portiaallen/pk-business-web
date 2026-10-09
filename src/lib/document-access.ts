import { requireRequestAccess } from "@/lib/capabilities";
import type { SessionUser } from "@/lib/auth";
/** Explicit client-scoped confidential grants, never ADMIN/STAFF role inheritance. */
export async function requireDocumentRequestAccess(user: SessionUser, requestId: string): Promise<void> {
  await requireRequestAccess(user, requestId);
}
