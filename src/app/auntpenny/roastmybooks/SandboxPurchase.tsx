"use client";
import { useState } from "react";
import type { IntakeAnswers } from "@/lib/auntpenny/roast-engine";
export function SandboxPurchase({ answers }: { answers: IntakeAnswers }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (process.env.NEXT_PUBLIC_AUNT_PENNY_SANDBOX_ENABLED !== "true" && process.env.NEXT_PUBLIC_AUNT_PENNY_LIVE_ENABLED !== "true") return null;
  async function start() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auntpenny/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, answers }) });
      if (!response.ok) throw new Error("Checkout unavailable");
      const data: unknown = await response.json();
      if (!data || typeof data !== "object" || !("url" in data) || typeof data.url !== "string" || !data.url.startsWith("https://checkout.stripe.com/")) throw new Error("Invalid checkout response");
      window.location.assign(data.url);
    } catch { setError("Checkout could not start. No charge was made here."); setBusy(false); }
  }
  return <div className="ap-card mt-6 p-6 ap-no-print">
    <h3 className="text-xl font-bold">{process.env.NEXT_PUBLIC_AUNT_PENNY_LIVE_ENABLED === "true" ? "Get your personalized report — $9.99" : "Sandbox purchase test — $9.99"}</h3>
    <p className="mt-2 text-sm">Unlock every roast, every evidence-backed finding, your priorities, full 7-day and 30-day plans, bookkeeper questions, a private emailed report link, and Print / Save as PDF. The free verdict, opening joke, two findings, and share card are yours to keep.</p>
    <p className="mt-2 text-sm">{process.env.NEXT_PUBLIC_AUNT_PENNY_LIVE_ENABLED === "true" ? "Secure one-time payment through Stripe." : "Test mode only. Do not enter real payment card details."}</p>
    <label className="mt-3 block">Email for your report<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 block w-full rounded-md border p-2 text-black" /></label>
    <button className="ap-cta mt-3" type="button" disabled={busy || !email.includes("@")} onClick={start}>{busy ? "Connecting..." : "Continue to secure checkout"}</button>
    {error && <p role="alert">{error}</p>}
  </div>;
}
