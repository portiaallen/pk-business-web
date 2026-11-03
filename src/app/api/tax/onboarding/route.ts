import { NextResponse } from "next/server";
import { createSession } from "@/lib/tax/onboarding-core";
import { taxSessionStoreOrThrow } from "@/lib/tax/session-storage";
import { rejectIfSensitive } from "@/lib/tax/intake-screen";

// POST /api/tax/onboarding - create an intake session.
// No real taxpayer data is accepted in this build; the session store resolves
// to the synthetic in-memory store under PK_CI_SYNTHETIC=1 and to the
// encrypted at-rest adapter when the owner has configured it. It refuses
// (503) rather than falling back to volatile storage.
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
  const session = createSession(typeof body.taxYear === "number" ? body.taxYear : 2026);
  await store.put(session);
  return NextResponse.json({
    sessionId: session.sessionId,
    taxYear: session.taxYear,
    mode: store.mode,
  });
}
