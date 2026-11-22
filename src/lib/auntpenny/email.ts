import { assertResourceEnvironment } from "@/lib/security-environment";

export async function sendAuntPennyLink(to: string, link: string) {
  assertResourceEnvironment("EMAIL");
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) throw new Error("Resend is not configured");
  const from = process.env.INVOICE_FROM_EMAIL?.trim();
  if (!from || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) throw new Error("Verified sender is not configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "PK Business Services <" + from + ">",
      to: [to],
      subject: "Your private Aunt Penny Roast My Books report",
      text: "Your personalized Aunt Penny report is ready. Open your private report link: " + link + "\n\nThis link expires in 24 hours. Do not forward it.\n\nPK Business Services",
    }),
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Report email delivery rejected: " + response.status);
}
