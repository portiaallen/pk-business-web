// Emails for the public Catch-Up 1040 intake: one notification to PK and one
// confirmation to the requester. Both are non-sensitive by design: the
// intake collects no SSNs, DOBs, bank details, or tax documents, and nothing
// sensitive may ever be invited over email. Mirrors the contact-form email
// pattern (shared Gmail transport, environment assertion, soft-fail so a
// notification failure never loses the stored submission).
import { assertResourceEnvironment } from "@/lib/security-environment";
import { CONTACT_RECIPIENT_EMAIL } from "@/lib/contact-email";
import nodemailer from "nodemailer";
import {
  CONTACT_TIME_OPTIONS,
  RECORDS_STATUS_OPTIONS,
} from "@/content/catchup-1040";
import type { CatchupYearScreening } from "@/content/catchup-1040";
import type { CatchupIntakePayload } from "@/lib/tax/catchup-intake";

const ADMIN_URL = "https://pkservices.business/admin/tax-catchup";

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

function yearLines(payload: CatchupIntakePayload, screening: CatchupYearScreening[]): string[] {
  return payload.taxYears.map((year) => {
    const status = labelFor(FILING_STATUS_LIST, payload.filingStatuses[year] ?? "");
    const filed = payload.alreadyFiled[year];
    const filedLabel =
      filed === "yes"
        ? "already filed (amendment review)"
        : filed === "not_sure"
          ? "filed status unconfirmed"
          : "not yet filed";
    const screen = screening.find((s) => s.year === year);
    const price = screen?.simpleEligible ? "$99 Simple 1040 rate screens as applicable (final after review)" : "quote after review";
    return `${year}: ${status}, ${filedLabel} — ${price}`;
  });
}

const FILING_STATUS_LIST = [
  { value: "single", label: "Single" },
  { value: "married_jointly", label: "Married filing jointly" },
  { value: "married_separately", label: "Married filing separately" },
  { value: "head_of_household", label: "Head of household" },
  { value: "qualifying_surviving_spouse", label: "Qualifying surviving spouse" },
  { value: "unknown", label: "Not sure yet" },
] as const;

export function buildCatchupNotificationEmail(
  payload: CatchupIntakePayload,
  screening: CatchupYearScreening[],
): { subject: string; text: string; html: string } {
  const lines = [
    "A new Catch-Up 1040 intake was submitted on pkservices.business/tax.",
    "",
    `Name: ${payload.fullName}`,
    `Email: ${payload.email}`,
    `Phone: ${payload.phone ?? "(none provided)"}`,
    `Preferred contact: ${payload.contactMethod === "phone" ? "Phone" : "Email"}${payload.contactTime ? ` (${labelFor(CONTACT_TIME_OPTIONS, payload.contactTime)})` : ""}`,
    `Tax years: ${payload.taxYears.join(", ")}`,
    "",
    "Per year:",
    ...yearLines(payload, screening),
    "",
    `Income types: ${payload.complexity.join(", ")}`,
    `States: ${payload.states.join(", ")}`,
    `IRS/state notices involved: ${payload.hasNotices ? "Yes" : "No"}`,
    `Records: ${labelFor(RECORDS_STATUS_OPTIONS, payload.recordsStatus)}`,
    payload.notes ? `Notes: ${payload.notes}` : "",
    "",
    `Review it in the admin portal: ${ADMIN_URL}`,
    "",
    "Sign in to the PK admin portal to review it.",
  ].filter((line) => line !== "");

  const subject = "New Catch-Up 1040 intake — PK Business Services";
  const text = lines.join("\n");
  const html = lines
    .map((line) =>
      line.startsWith("http") ? `<p><a href="${line}">${line}</a></p>` : `<p>${escapeHtml(line)}</p>`,
    )
    .join("");
  return { subject, text, html };
}

export function buildCatchupConfirmationEmail(
  payload: CatchupIntakePayload,
): { subject: string; text: string; html: string } {
  const subject = "We received your Catch-Up 1040 request — PK Business Services";
  const text = [
    `Hi ${payload.fullName},`,
    "",
    "Thanks for your Catch-Up 1040 request. PK received it and will review what you shared, then follow up using your preferred contact method.",
    "",
    "What happens next:",
    "1. PK reviews your request and confirms pricing. Qualifying simple returns start at $99 per tax year; a $35 federal e-filing fee applies per eligible return only, and federal e-file eligibility is confirmed by year. Other return types and bundles are quoted after review.",
    "2. If you accept the quote, PK collects what is needed for the engagement through its secure client process.",
    "3. Nothing is filed until you have reviewed and approved it.",
    "",
    "A reminder for your safety: never email tax documents, Social Security numbers, ITINs, or bank details. Sensitive information moves only through PK's secure client process after you become a client.",
    "",
    "Submitting this request is not an engagement, and no return has been filed on your behalf.",
    "",
    "No judgment. Just a practical place to start.",
    "PK Business Services — People | Knowledge | Results",
  ].join("\n");
  const html = [
    `<p>Hi ${escapeHtml(payload.fullName)},</p>`,
    "<p>Thanks for your Catch-Up 1040 request. PK received it and will review what you shared, then follow up using your preferred contact method.</p>",
    "<p><strong>What happens next:</strong></p>",
    "<ol>",
    "<li>PK reviews your request and confirms pricing. Qualifying simple returns start at $99 per tax year; a $35 federal e-filing fee applies per eligible return only, and federal e-file eligibility is confirmed by year. Other return types and bundles are quoted after review.</li>",
    "<li>If you accept the quote, PK collects what is needed for the engagement through its secure client process.</li>",
    "<li>Nothing is filed until you have reviewed and approved it.</li>",
    "</ol>",
    "<p>A reminder for your safety: never email tax documents, Social Security numbers, ITINs, or bank details. Sensitive information moves only through PK's secure client process after you become a client.</p>",
    "<p>Submitting this request is not an engagement, and no return has been filed on your behalf.</p>",
    "<p>No judgment. Just a practical place to start.<br>PK Business Services &mdash; People | Knowledge | Results</p>",
  ].join("");
  return { subject, text, html };
}

export interface CatchupEmailOutcome {
  notificationSent: boolean;
  confirmationSent: boolean;
}

export async function sendCatchupIntakeEmails(
  payload: CatchupIntakePayload,
  screening: CatchupYearScreening[],
): Promise<CatchupEmailOutcome> {
  const gmailUser = process.env.GMAIL_USER?.trim() || CONTACT_RECIPIENT_EMAIL;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.trim();
  const notificationTo = process.env.CONTACT_EMAIL?.trim() || CONTACT_RECIPIENT_EMAIL;

  const outcome: CatchupEmailOutcome = { notificationSent: false, confirmationSent: false };
  if (!gmailAppPassword) {
    // Same soft-fail contract as the contact form: the submission is already
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
    const notification = buildCatchupNotificationEmail(payload, screening);
    await transporter.sendMail({
      from: `PK Business Services <${gmailUser}>`,
      to: notificationTo,
      subject: notification.subject,
      text: notification.text,
      html: notification.html,
    });
    outcome.notificationSent = true;
  } catch {
    // Soft-fail: storage already succeeded; the route reports the flag.
  }

  try {
    const confirmation = buildCatchupConfirmationEmail(payload);
    await transporter.sendMail({
      from: `PK Business Services <${gmailUser}>`,
      to: payload.email,
      subject: confirmation.subject,
      text: confirmation.text,
      html: confirmation.html,
    });
    outcome.confirmationSent = true;
  } catch {
    // Soft-fail.
  }

  return outcome;
}
