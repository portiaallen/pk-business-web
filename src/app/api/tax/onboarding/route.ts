import { NextResponse } from "next/server";
import { createSession, putSyntheticSession } from "@/lib/tax/session-store";
import { rejectIfSensitive } from "@/lib/tax/intake-screen";

// POST /api/tax/onboarding - create a synthetic-mode intake session.
// No real taxpayer data is accepted in this build; sessions are synthetic
// until security validation and founder sign-off.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const screen = rejectIfSensitive(body);
  if (!screen.allowed) {
    return NextResponse.json(
      {
        error: "REJECTED_BEFORE_PERSISTENCE",
        findings: screen.findings.map((f) => f.label),
      },
      { status: 422 },
    );
  }
  const session = createSession(typeof body.taxYear === "number" ? body.taxYear : 2026);
  putSyntheticSession(session);
  return NextResponse.json({
    sessionId: session.sessionId,
    taxYear: session.taxYear,
    mode: "synthetic-only",
  });
}
