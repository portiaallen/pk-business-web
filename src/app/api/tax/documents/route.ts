import { NextResponse } from "next/server";
import {
  attest,
  closeAccess,
  grantAccess,
  uploadDocument,
  verifyIdentity,
} from "@/lib/tax/onboarding-core";
import { taxSessionStoreOrThrow } from "@/lib/tax/session-storage";
import { rejectIfSensitive } from "@/lib/tax/intake-screen";

// POST /api/tax/documents - actions: verify | grant | upload | attest | close.
// Identity verification and access control are fail-closed. The production
// storage adapter (PK restricted backend/vault) is owner-configured; no file
// content is accepted or transmitted in this build.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { sessionId?: string; action?: string; verified?: boolean; meta?: { name?: string } }
    | null;
  if (!body || !body.sessionId || !body.action) {
    return NextResponse.json({ error: "sessionId and action are required" }, { status: 400 });
  }
  let store;
  try {
    store = taxSessionStoreOrThrow();
  } catch (error) {
    const failClosed = error as { status?: number; response?: unknown };
    if (failClosed.status === 503) {
      return NextResponse.json(failClosed.response, { status: 503 });
    }
    throw error;
  }
  const session = await store.get(body.sessionId);
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
  await store.put(session);
  return NextResponse.json({ ok, gates: session.gates, mode: store.mode });
}
