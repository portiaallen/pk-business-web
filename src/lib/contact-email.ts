import nodemailer from "nodemailer";
import { serviceOptions } from "@/content/services";

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

function getServiceLabel(serviceId: string): string {
  return (
    serviceOptions.find((option) => option.value === serviceId)?.label ??
    serviceId
  );
}

function formatContactMethod(method: string): string {
  switch (method) {
    case "email":
      return "Email";
    case "phone":
      return "Phone";
    case "either":
      return "Either";
    default:
      return method;
  }
}

export function buildContactEmailContent(payload: ContactFormPayload) {
  const serviceLabel = getServiceLabel(payload.service);

  const text = [
    "New consultation request — PK Business Services",
    "",
    `Name: ${payload.fullName}`,
    `Email: ${payload.email}`,
    `Phone: ${payload.phone || "Not provided"}`,
    `Business: ${payload.businessName || "Not provided"}`,
    `Service: ${serviceLabel}`,
    `Preferred contact: ${formatContactMethod(payload.contactMethod)}`,
    "",
    "Description:",
    payload.description,
  ].join("\n");

  const html = `
    <h2>New consultation request</h2>
    <p><strong>Name:</strong> ${escapeHtml(payload.fullName)}</p>
    <p><strong>Email:</strong> <a href="mailto:${escapeHtml(payload.email)}">${escapeHtml(payload.email)}</a></p>
    <p><strong>Phone:</strong> ${escapeHtml(payload.phone || "Not provided")}</p>
    <p><strong>Business:</strong> ${escapeHtml(payload.businessName || "Not provided")}</p>
    <p><strong>Service:</strong> ${escapeHtml(serviceLabel)}</p>
    <p><strong>Preferred contact:</strong> ${escapeHtml(formatContactMethod(payload.contactMethod))}</p>
    <p><strong>Description:</strong></p>
    <p>${escapeHtml(payload.description).replace(/\n/g, "<br>")}</p>
  `;

  return { text, html, serviceLabel };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendContactEmail(payload: ContactFormPayload) {
  const gmailUser =
    process.env.GMAIL_USER?.trim() || CONTACT_RECIPIENT_EMAIL;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.trim();
  const to = process.env.CONTACT_EMAIL?.trim() || CONTACT_RECIPIENT_EMAIL;

  if (!gmailAppPassword) {
    throw new Error("GMAIL_APP_PASSWORD is not configured");
  }

  const { text, html, serviceLabel } = buildContactEmailContent(payload);

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
    replyTo: payload.email,
    subject: `Consultation request: ${serviceLabel} — ${payload.fullName}`,
    text,
    html,
  });
}
