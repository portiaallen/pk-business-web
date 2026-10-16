import { NextResponse } from "next/server";
import { canTransmit, clearPreparerGate } from "@/lib/tax/onboarding-core";
import { getSyntheticSession } from "@/lib/tax/session-store";

// Preparer-only dashboard and review gate.
//
// FAILS CLOSED: this route refuses every request unless the owner has set
// PK_PREPARER_KEY and the request presents it. It must be wired to the
// repository's existing admin/WebAuthn session authentication (src/lib/auth,
// admin-access) before any production use; the environment key is the
// synthetic-build stand-in, not the production control.
function authorized(request: Request): boolean {
  const configured = process.env.PK_PREPARER_KEY;
  if (!configured) return false; // fail closed when not configured
  return request.headers.get("x-pk-preparer-key") === configured;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const sessionId = new URL(request.url).searchParams.get("sessionId") ?? "";
  const session = getSyntheticSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  return NextResponse.json({
    ddTriggers: session.ddTriggers,
    flags: session.flags,
    checklist: session.checklist,
    audit: session.audit,
    transmission: canTransmit(session),
  });
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as
    | { sessionId?: string; action?: string; preparer?: string }
    | null;
  if (!body || !body.sessionId || !body.action) {
    return NextResponse.json({ error: "sessionId and action are required" }, { status: 400 });
  }
  const session = getSyntheticSession(body.sessionId);
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  if (body.action === "clear_review_gate") {
    clearPreparerGate(session, body.preparer ?? "unnamed preparer");
    return NextResponse.json({ cleared: true, transmission: canTransmit(session) });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
