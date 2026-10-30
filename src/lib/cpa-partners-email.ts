// Emails for the PK Practice Partners CPA firm application: one notification
// to PK and one confirmation to the applying firm. Non-sensitive by design:
// the application collects no taxpayer files, SSNs, client data, or bank
// details, and nothing sensitive may ever be invited over email. Mirrors the
// catch-up intake email pattern (shared Gmail transport, environment
// assertion, soft-fail so a notification failure never loses the stored
// application).
import { assertResourceEnvironment } from "@/lib/security-environment";
import { CONTACT_RECIPIENT_EMAIL } from "@/lib/contact-email";
import nodemailer from "nodemailer";
import {
  CPA_PARTNERSHIP_MODEL_OPTIONS,
  CPA_SERVICE_NEED_OPTIONS,
  CPA_PAYMENT_TERMS,
} from "@/content/cpa-partners";
import type { CpaPartnerPayload } from "@/lib/cpa-partners";

const ADMIN_URL = "https://pkservices.business/admin/cpa-partners";

function labelFor(options: ReadonlyArray<{ value: string; label: string }>, value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildCpaPartnerNotificationEmail(
  payload: CpaPartnerPayload,
  applicationId: string,
): { subject: string; text: string; html: string } {
  const lines = [
    "A new PK Practice Partners application was submitted on pkservices.business/partners/cpa.",
    "",
    `Firm: ${payload.firmName}`,
    `Authorized contact: ${payload.contactName}`,
    `Business email: ${payload.email}`,
    `Phone: ${payload.phone ?? "(none provided)"}`,
    `Service needs: ${payload.serviceNeeds.map((s) => labelFor(CPA_SERVICE_NEED_OPTIONS, s)).join(", ")}`,
    `Partnership model: ${labelFor(CPA_PARTNERSHIP_MODEL_OPTIONS, payload.partnershipModel)}`,
    "",
    "Scope (non-sensitive summary):",
    payload.scopeNotes,
    "",
    `Application reference: ${applicationId}`,
    "",
    `Review it in the admin portal: ${ADMIN_URL}`,
    "",
    "Founder approval is required before any firm is approved, quoted, or onboarded.",
    "The firm retains its client relationship; PK does not solicit partner firms' clients.",
  ].filter((line) => line !== "");

  const subject = "New PK Practice Partners application — PK Business Services";
  const text = lines.join("\n");
  const html = lines
    .map((line) =>
      line.startsWith("http") ? `<p><a href="${line}">${line}</a></p>` : `<p>${escapeHtml(line)}</p>`,
    )
    .join("");
  return { subject, text, html };
}

export function buildCpaPartnerConfirmationEmail(
  payload: CpaPartnerPayload,
): { subject: string; text: string; html: string } {
  const subject = "We received your PK Practice Partners application — PK Business Services";
  const text = [
    `Hi ${payload.contactName},`,
    "",
    `Thanks for your interest in PK Practice Partners. We received ${payload.firmName}'s application and will review it personally.`,
    "",
    "What happens next:",
    "1. PK reviews the application and follows up with questions or a conversation.",
    `2. If the fit is right, PK sends a written quote. ${CPA_PAYMENT_TERMS.agreement}.`,
    `3. ${CPA_PAYMENT_TERMS.deposit}; ${CPA_PAYMENT_TERMS.smallInvoice}.`,
    "",
    "Your firm always keeps the client relationship. PK does not solicit your clients, and any support work is scoped in writing before it starts.",
    "",
    "A reminder for your safety and ours: never email taxpayer files, Social Security numbers, or other sensitive client data. Once a firm is approved, document sharing moves only through PK's secure document process.",
    "",
    "Submitting this application is not an engagement, and no work has started on your behalf.",
    "",
    "PK Business Services — People | Knowledge | Results",
  ].join("\n");
  const html = [
    `<p>Hi ${escapeHtml(payload.contactName)},</p>`,
    `<p>Thanks for your interest in PK Practice Partners. We received ${escapeHtml(payload.firmName)}'s application and will review it personally.</p>`,
    `<p><strong>What happens next:</strong></p>`,
    "<ol>",
    "<li>PK reviews the application and follows up with questions or a conversation.</li>",
    `<li>If the fit is right, PK sends a written quote. ${escapeHtml(CPA_PAYMENT_TERMS.agreement)}.</li>`,
    `<li>${escapeHtml(CPA_PAYMENT_TERMS.deposit)}; ${escapeHtml(CPA_PAYMENT_TERMS.smallInvoice)}.</li>`,
    "</ol>",
    "<p>Your firm always keeps the client relationship. PK does not solicit your clients, and any support work is scoped in writing before it starts.</p>",
    "<p>A reminder for your safety and ours: never email taxpayer files, Social Security numbers, or other sensitive client data. Once a firm is approved, document sharing moves only through PK's secure document process.</p>",
    "<p>Submitting this application is not an engagement, and no work has started on your behalf.</p>",
    "<p>PK Business Services &mdash; People | Knowledge | Results</p>",
  ].join("");
  return { subject, text, html };
}

export interface CpaPartnerEmailOutcome {
  notificationSent: boolean;
  confirmationSent: boolean;
}

export async function sendCpaPartnerEmails(
  payload: CpaPartnerPayload,
  applicationId: string,
): Promise<CpaPartnerEmailOutcome> {
  const gmailUser = process.env.GMAIL_USER?.trim() || CONTACT_RECIPIENT_EMAIL;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.trim();
  const notificationTo = process.env.CONTACT_EMAIL?.trim() || CONTACT_RECIPIENT_EMAIL;

  const outcome: CpaPartnerEmailOutcome = { notificationSent: false, confirmationSent: false };
  if (!gmailAppPassword) {
    // Same soft-fail contract as the contact form: the application is already
    // stored and visible in the admin portal; the email failure is surfaced
    // in the API response and logged content-free by the route.
    return outcome;
  }

  assertResourceEnvironment("EMAIL");
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmailUser, pass: gmailAppPassword },
  });

  try {
    const notification = buildCpaPartnerNotificationEmail(payload, applicationId);
    await transporter.sendMail({
      from: `PK Business Services <${gmailUser}>`,
      to: notificationTo,
      subject: notification.subject,
      text: notification.text,
      html: notification.html,
    });
    outcome.notificationSent = true;
  } catch {
    // Soft-fail: logged content-free by the route.
  }

  try {
    const confirmation = buildCpaPartnerConfirmationEmail(payload);
    await transporter.sendMail({
      from: `PK Business Services <${gmailUser}>`,
      to: payload.email,
      subject: confirmation.subject,
      text: confirmation.text,
      html: confirmation.html,
    });
    outcome.confirmationSent = true;
  } catch {
    // Soft-fail: logged content-free by the route.
  }

  return outcome;
}
