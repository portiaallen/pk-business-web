import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  sendContactEmail,
  type ContactFormPayload,
} from "@/lib/contact-email";
import { serviceOptions } from "@/content/services";

const validServices = new Set(serviceOptions.map((option) => option.value));
const validContactMethods = new Set(["email", "phone", "either"]);

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parsePayload(body: unknown): ContactFormPayload | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const data = body as Record<string, unknown>;

  const fullName =
    typeof data.fullName === "string" ? data.fullName.trim() : "";
  const email = typeof data.email === "string" ? data.email.trim() : "";
  const phone = typeof data.phone === "string" ? data.phone.trim() : "";
  const businessName =
    typeof data.businessName === "string" ? data.businessName.trim() : "";
  const service = typeof data.service === "string" ? data.service.trim() : "";
  const description =
    typeof data.description === "string" ? data.description.trim() : "";
  const contactMethod =
    typeof data.contactMethod === "string" ? data.contactMethod.trim() : "email";

  if (!fullName || !email || !service || !description) {
    return null;
  }

  if (!isValidEmail(email)) {
    return null;
  }

  if (!validServices.has(service)) {
    return null;
  }

  if (!validContactMethods.has(contactMethod)) {
    return null;
  }

  return {
    fullName,
    email,
    phone,
    businessName,
    service,
    description,
    contactMethod,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = parsePayload(body);

    if (!payload) {
      return NextResponse.json(
        { error: "Please complete all required fields with valid information." },
        { status: 400 }
      );
    }

    // Persist first: every valid submission must create a durable record that
    // shows up in the admin portal, even if the notification email fails.
    const submission = await prisma.intakeSubmission.create({
      data: {
        fullName: payload.fullName,
        email: payload.email,
        phone: payload.phone || null,
        businessName: payload.businessName || null,
        serviceSlug: payload.service,
        description: payload.description,
        contactMethod: payload.contactMethod,
      },
    });

    let emailSent = false;
    try {
      await sendContactEmail(payload);
      emailSent = true;
    } catch (emailError) {
      // The record is safe; surface the email failure without losing the submission.
      console.error("Contact form email failed:", emailError);
    }

    return NextResponse.json({
      success: true,
      id: submission.id,
      emailSent,
    });
  } catch (error) {
    console.error("Contact form submission failed:", error);

    return NextResponse.json(
      {
        error:
          "We could not send your request right now. Please try again shortly.",
      },
      { status: 500 }
    );
  }
}
