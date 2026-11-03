// PK Business Clarity Collection — product intake endpoint (M2).
// Accepts a product questionnaire submission, validates it server-side against
// the questionnaire definition, screens it for sensitive taxpayer information,
// and persists a durable IntakeSubmission visible in the admin portal. Source
// channel tracking ("direct" vs "groupon") is recorded on every submission.
// No sensitive identifiers are ever persisted from this route.

import { logSecurityEvent } from "@/lib/security-log";
import { MARKETING_CONSENT_VERSION } from "@/lib/marketing-consent";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordMarketingConsent } from "@/lib/marketing-consent";
import {
  validateClarityIntake,
  buildIntakeSummary,
} from "@/lib/clarity-intake";
import { clarityProducts } from "@/content/clarity";
import {
  clarityIntakeDefinition,
  CLARITY_INTAKE_SENSITIVE_GUIDANCE,
} from "@/content/clarity-intake";
import { SENSITIVE_DATA_GUIDANCE } from "@/lib/sensitive-data";

const validProductIds = new Set<string>(clarityProducts.map((product) => product.id));

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Please complete all required fields with valid information." },
        { status: 400 }
      );
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Please complete all required fields with valid information." },
        { status: 400 }
      );
    }

    const data = body as Record<string, unknown>;
    const productId = typeof data.productId === "string" ? data.productId.trim() : "";
    const fullName = typeof data.fullName === "string" ? data.fullName.trim() : "";
    const email = typeof data.email === "string" ? data.email.trim() : "";
    const phone = typeof data.phone === "string" ? data.phone.trim() : "";
    const businessName =
      typeof data.businessName === "string" ? data.businessName.trim() : "";
    const contactMethod =
      typeof data.contactMethod === "string" ? data.contactMethod.trim() : "email";
    const marketingOptIn = data.marketingOptIn === true;

    if (!productId || !validProductIds.has(productId)) {
      return NextResponse.json({ error: "Unknown product." }, { status: 400 });
    }
    if (!fullName || !email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please provide your name and a valid email address." },
        { status: 400 }
      );
    }
    if (!["email", "phone", "either"].includes(contactMethod)) {
      return NextResponse.json(
        { error: "Please choose how PK should reach you." },
        { status: 400 }
      );
    }

    const definition = clarityIntakeDefinition(productId);
    if (!definition) {
      return NextResponse.json({ error: "Unknown product." }, { status: 400 });
    }

    const result = validateClarityIntake(productId, data.answers);
    if (result.sensitive) {
      logSecurityEvent("CLARITY_INTAKE_SENSITIVE_DATA_REJECTED");
      return NextResponse.json(
        { error: CLARITY_INTAKE_SENSITIVE_GUIDANCE || SENSITIVE_DATA_GUIDANCE },
        { status: 400 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { error: "Some answers need attention.", details: result.errors },
        { status: 422 }
      );
    }

    const summary = buildIntakeSummary(definition, result.validated);

    // Persist first: every valid submission creates a durable record that shows
    // up in the admin portal even when the notification step fails.
    const submission = await prisma.intakeSubmission.create({
      data: {
        fullName,
        email,
        phone: phone || null,
        businessName: businessName || null,
        serviceSlug: `clarity:${productId}`,
        description: summary,
        contactMethod,
        marketingConsent: marketingOptIn ? true : null,
        marketingConsentAt: marketingOptIn ? new Date() : null,
        marketingConsentVersion: marketingOptIn ? MARKETING_CONSENT_VERSION : null,
        sourceChannel: "direct",
        questionnaireVersion: definition.version,
        questionnaireJson: JSON.stringify(result.validated),
      },
    });

    if (marketingOptIn) {
      await recordMarketingConsent(email, true, "clarity-intake");
    }

    return NextResponse.json(
      {
        ok: true,
        submissionId: submission.id,
        message:
          "Your intake is in. PK will follow up with next steps and how to submit documents securely.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("clarity intake error", error);
    return NextResponse.json(
      { error: "Something went wrong on our end. Please try again." },
      { status: 500 }
    );
  }
}
