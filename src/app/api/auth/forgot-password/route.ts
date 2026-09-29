import { NextResponse } from "next/server";
import { handleApiError, ApiError } from "@/lib/api-error";
import { requestPasswordReset } from "@/lib/password-reset";

// One constant response for every outcome (matching account, non-matching
// email, cooldown window, or failed email send) — never reveals account
// existence or delivery status.
const GENERIC_RESPONSE = {
  accepted: true,
  message:
    "If this is the PK admin account, a reset link has been sent to the verified PK contact inbox. You can request another link in 10 minutes.",
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email || !email.includes("@")) {
      throw ApiError.badRequest("A valid email is required");
    }

    await requestPasswordReset(email);

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (error) {
    return handleApiError(error);
  }
}
