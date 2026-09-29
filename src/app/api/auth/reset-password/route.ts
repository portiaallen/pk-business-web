import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { confirmPasswordReset } from "@/lib/password-reset";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!token || !password) {
      return NextResponse.json(
        { error: "Reset link and new password are required" },
        { status: 400 }
      );
    }

    await confirmPasswordReset(token, password);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
