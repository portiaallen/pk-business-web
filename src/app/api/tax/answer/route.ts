import { NextResponse } from "next/server";
import { compute, recordAnswer } from "@/lib/tax/onboarding-core";
import { getSyntheticSession } from "@/lib/tax/session-store";
import { rejectIfSensitive } from "@/lib/tax/intake-screen";

// POST /api/tax/answer - record a non-sensitive intake answer.
// Sensitive payloads are rejected server-side BEFORE persistence.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { sessionId?: string; key?: string; value?: unknown }
    | null;
  if (!body || !body.sessionId || !body.key) {
    return NextResponse.json({ error: "sessionId and key are required" }, { status: 400 });
  }
  const screen = rejectIfSensitive({ [body.key]: body.value });
  if (!screen.allowed) {
    return NextResponse.json(
      {
        error: "REJECTED_BEFORE_PERSISTENCE",
        findings: screen.findings.map((f) => f.label),
        note: "This value must be provided only through PK's approved secure document workflow.",
      },
      { status: 422 },
    );
  }
  const session = getSyntheticSession(body.sessionId);
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  recordAnswer(session, body.key, body.value);
  compute(session);
  return NextResponse.json({
    recorded: true,
    flags: session.flags.map((f) => ({ code: f.code, severity: f.severity })),
    ddTriggers: session.ddTriggers,
    checklist: session.checklist,
    pending: session.pending,
  });
}
