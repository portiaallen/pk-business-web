import { assertResourceEnvironment } from "@/lib/security-environment";
import nodemailer from "nodemailer";

export const CONTACT_RECIPIENT_EMAIL = "portiaallen40@gmail.com";

export interface ContactFormPayload {
  fullName: string;
  email: string;
  phone?: string;
  businessName?: string;
  service: string;
  description: string;
  contactMethod: string;
}

export function buildContactEmailContent() {
  const text = "A new consultation request is available. Sign in to the PK admin portal to review it.";
  return { text, html: `<p>${text}</p>`, serviceLabel: "Consultation" };
}

export async function sendContactEmail() {
  const gmailUser =
    process.env.GMAIL_USER?.trim() || CONTACT_RECIPIENT_EMAIL;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.trim();
  const to = process.env.CONTACT_EMAIL?.trim() || CONTACT_RECIPIENT_EMAIL;

  if (!gmailAppPassword) {
    throw new Error("GMAIL_APP_PASSWORD is not configured");
  }

  const { text, html, serviceLabel } = buildContactEmailContent();

  assertResourceEnvironment("EMAIL");
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  });

  await transporter.sendMail({
    from: `PK Business Services <${gmailUser}>`,
    to,
    subject: `New ${serviceLabel.toLowerCase()} request — PK Business Services`,
    text,
    html,
  });
}
