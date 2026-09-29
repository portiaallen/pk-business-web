import { NextResponse } from "next/server";
import { handleApiError, ApiError } from "@/lib/api-error";
import { requestPasswordReset, RESET_REQUEST_COOLDOWN_MINUTES } from "@/lib/password-reset";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email || !email.includes("@")) {
      throw ApiError.badRequest("A valid email is required");
    }

    const result = await requestPasswordReset(email);

    // Always the same generic response — never reveals account existence.
    return NextResponse.json({
      accepted: true,
      message: result.accepted
        ? `If this is the PK admin account, a reset link has been sent to the verified PK contact inbox. You can request another link in ${RESET_REQUEST_COOLDOWN_MINUTES} minutes.`
        : "Request received.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
