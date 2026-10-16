import { NextResponse } from "next/server";
import {
  attest,
  closeAccess,
  grantAccess,
  uploadDocument,
  verifyIdentity,
} from "@/lib/tax/onboarding-core";
import { getSyntheticSession } from "@/lib/tax/session-store";
import { rejectIfSensitive } from "@/lib/tax/intake-screen";

// POST /api/tax/documents - actions: verify | grant | upload | attest | close.
// Identity verification and access control are fail-closed. The production
// storage adapter (PK restricted backend/vault) is owner-configured; this
// build ships only the synthetic in-memory store and performs no real file
// writes. No file content is accepted or transmitted in this build.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { sessionId?: string; action?: string; verified?: boolean; meta?: { name?: string } }
    | null;
  if (!body || !body.sessionId || !body.action) {
    return NextResponse.json({ error: "sessionId and action are required" }, { status: 400 });
  }
  const session = getSyntheticSession(body.sessionId);
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }

  if (body.action === "upload") {
    const screen = rejectIfSensitive(body.meta ?? {});
    if (!screen.allowed) {
      return NextResponse.json(
        { error: "REJECTED_BEFORE_PERSISTENCE", findings: screen.findings.map((f) => f.label) },
        { status: 422 },
      );
    }
  }

  let ok = false;
  switch (body.action) {
    case "verify":
      ok = verifyIdentity(session, body.verified === true);
      break;
    case "grant":
      ok = grantAccess(session);
      break;
    case "upload":
      ok = uploadDocument(session, body.meta);
      break;
    case "attest":
      ok = attest(session);
      break;
    case "close":
      closeAccess(session);
      ok = true;
      break;
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
  return NextResponse.json({ ok, access: session.access, uploads: session.uploads.length });
}
