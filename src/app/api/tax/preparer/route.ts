import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/capabilities";
import { requireRecentAuthentication } from "@/lib/auth";
import { canTransmit, clearPreparerGate } from "@/lib/tax/onboarding-core";
import { taxSessionStoreOrThrow } from "@/lib/tax/session-storage";
import { ApiError, handleApiError } from "@/lib/api-error";

// Preparer-only dashboard and review gate.
//
// Authentication is the repository's existing staff session auth, whose
// sessions are only valid with WebAuthn assurance (see sessionValid in
// @/lib/auth): a staff user reaches this route only through a live
// WebAuthn-verified session. requireRecentAuthentication additionally gates
// the review-clearing write. The former PK_PREPARER_KEY environment stand-in
// is gone: no shared static secret remains on this route.
function failClosedResponse(error: unknown): NextResponse | null {
  const failClosed = error as { status?: number; response?: unknown };
  if (failClosed.status === 503 && failClosed.response) {
    return NextResponse.json(failClosed.response, { status: 503 });
  }
  return null;
}

export async function GET(request: Request) {
  try {
    await requireStaff(request); // WebAuthn-assured staff session required
    const sessionId = new URL(request.url).searchParams.get("sessionId") ?? "";
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }
    const store = taxSessionStoreOrThrow();
    const session = await store.get(sessionId);
    if (!session) {
      return NextResponse.json({ error: "session not found" }, { status: 404 });
    }
    return NextResponse.json({
      ddTriggers: session.ddTriggers,
      flags: session.flags,
      checklist: session.checklist,
      audit: session.audit,
      transmission: canTransmit(session),
      mode: store.mode,
    });
  } catch (error) {
    const failClosed = failClosedResponse(error);
    if (failClosed) return failClosed;
    if (error instanceof ApiError) return handleApiError(error);
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireStaff(request);
    requireRecentAuthentication(user); // step-up before any state change
    const body = (await request.json().catch(() => null)) as
      | { sessionId?: string; action?: string; preparer?: string }
      | null;
    if (!body || !body.sessionId || !body.action) {
      return NextResponse.json({ error: "sessionId and action are required" }, { status: 400 });
    }
    const store = taxSessionStoreOrThrow();
    const session = await store.get(body.sessionId);
    if (!session) {
      return NextResponse.json({ error: "session not found" }, { status: 404 });
    }
    if (body.action === "clear_review_gate") {
      clearPreparerGate(session, body.preparer ?? user.name ?? "unnamed preparer");
      await store.put(session);
      return NextResponse.json({ cleared: true, transmission: canTransmit(session), mode: store.mode });
    }
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (error) {
    const failClosed = failClosedResponse(error);
    if (failClosed) return failClosed;
    return handleApiError(error);
  }
}
