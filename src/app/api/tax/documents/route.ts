import { NextResponse } from "next/server";
import {
  attest,
  closeAccess,
  requestIdentityVerification,
  submitIdentityDocuments,
  uploadDocument,
} from "@/lib/tax/onboarding-core";
import { taxSessionStoreOrThrow } from "@/lib/tax/session-storage";
import { rejectIfSensitive } from "@/lib/tax/intake-screen";

// POST /api/tax/documents - actions: verify | identity_docs | upload | attest | close.
// Identity proofing is preparer-reviewed (founder-approved, 2026-10-19): a
// client may only REQUEST identity review here. Limited secure access is
// opened by a WebAuthn-authenticated preparer, after which the client submits
// ID documents through the approved secure client process. No file content is
// accepted or transmitted in this build; access control stays fail-closed.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { sessionId?: string; action?: string; meta?: { name?: string } }
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
      ok = requestIdentityVerification(session);
      break;
    case "identity_docs":
      ok = submitIdentityDocuments(session);
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
  return NextResponse.json({ ok, gates: session.gates, identity: session.identity, mode: store.mode });
}
