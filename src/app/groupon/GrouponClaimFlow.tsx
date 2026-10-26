"use client";

import { useState } from "react";

type Phase = "form" | "submitting" | "success" | "error";

export function GrouponClaimFlow() {
  const [phase, setPhase] = useState<Phase>("form");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPhase("submitting");
    setMessage("");
    try {
      const res = await fetch("/api/groupon/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          redemptionCode: String(data.get("redemptionCode") ?? ""),
          fullName: String(data.get("fullName") ?? ""),
          email: String(data.get("email") ?? ""),
          phone: String(data.get("phone") ?? ""),
          website: String(data.get("website") ?? ""),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setPhase("error");
        setMessage(json.error || "Something went wrong. Please try again.");
        return;
      }
      setPhase("success");
      form.reset();
    } catch {
      setPhase("error");
      setMessage("Something went wrong. Please try again.");
    }
  }

  if (phase === "success") {
    return (
      <div className="rounded-2xl border border-gold/30 bg-white p-8 text-center">
        <h2 className="pk-heading text-2xl font-semibold">Code received.</h2>
        <p className="mt-3 text-muted-gray">
          Your voucher is now in our verification queue. We check every code
          against Groupon before honoring it, and we will email you a private
          link to start your Business Readiness Assessment as soon as it is
          verified. Watch your inbox.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-gold/30 bg-white p-8">
      <div>
        <label htmlFor="redemptionCode" className="block text-sm font-semibold text-charcoal">
          Groupon redemption code
        </label>
        <input
          id="redemptionCode"
          name="redemptionCode"
          required
          maxLength={40}
          autoComplete="off"
          placeholder="As shown on your voucher"
          className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 text-charcoal focus:border-gold focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="fullName" className="block text-sm font-semibold text-charcoal">
          Full name
        </label>
        <input
          id="fullName"
          name="fullName"
          required
          maxLength={120}
          autoComplete="name"
          className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 text-charcoal focus:border-gold focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-semibold text-charcoal">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          maxLength={200}
          autoComplete="email"
          className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 text-charcoal focus:border-gold focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="phone" className="block text-sm font-semibold text-charcoal">
          Phone <span className="font-normal text-muted-gray">(optional)</span>
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          maxLength={40}
          autoComplete="tel"
          className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 text-charcoal focus:border-gold focus:outline-none"
        />
      </div>
      {/* Honeypot: humans never see or fill this. */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {phase === "error" && message ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={phase === "submitting"}
        className="w-full rounded-lg bg-charcoal px-6 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {phase === "submitting" ? "Submitting..." : "Submit code for verification"}
      </button>
      <p className="text-xs leading-relaxed text-muted-gray">
        This form never asks for Social Security numbers, payment details, or
        tax documents. Verification is handled by our team directly with
        Groupon.
      </p>
    </form>
  );
}
