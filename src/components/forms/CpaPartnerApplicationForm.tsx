"use client";

// Public CPA partner application form on /partners/cpa. Mobile-first,
// client-validated, and non-sensitive by design: the form never collects
// taxpayer files, SSNs, or client data, and the server re-validates and
// screens everything before anything is stored.
import { useState } from "react";
import {
  CPA_ACKNOWLEDGEMENT_LABEL,
  CPA_PARTNERSHIP_MODEL_OPTIONS,
  CPA_SERVICE_NEED_OPTIONS,
} from "@/content/cpa-partners";

interface SubmitState {
  status: "idle" | "submitting" | "success" | "error";
  message: string;
}

const inputClass =
  "mt-1 w-full rounded-md border border-border bg-white px-3 py-2.5 text-base";
const labelClass = "block text-sm font-semibold text-charcoal";

export default function CpaPartnerApplicationForm() {
  const [state, setState] = useState<SubmitState>({ status: "idle", message: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    firmName: "",
    contactName: "",
    email: "",
    phone: "",
    partnershipModel: "",
    scopeNotes: "",
    acknowledgement: false,
    website: "", // honeypot: hidden from users, bots fill it
  });
  const [serviceNeeds, setServiceNeeds] = useState<string[]>([]);

  function update<K extends keyof typeof form>(key: K, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  }

  function toggleService(value: string) {
    setServiceNeeds((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.serviceNeeds;
      return next;
    });
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!form.firmName.trim()) errors.firmName = "Please enter your firm's name.";
    if (!form.contactName.trim())
      errors.contactName = "Please enter the authorized contact's name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      errors.email = "Please enter a valid business email address.";
    const digits = form.phone.replace(/\D/g, "");
    if (digits && digits.length < 10) errors.phone = "Please enter a valid phone number.";
    if (serviceNeeds.length === 0)
      errors.serviceNeeds = "Please select at least one service need.";
    if (!form.partnershipModel)
      errors.partnershipModel = "Please choose a partnership model.";
    if (!form.scopeNotes.trim())
      errors.scopeNotes = "Please give a brief, non-sensitive description of the work you need.";
    if (!form.acknowledgement) errors.acknowledgement = "Please confirm the acknowledgement below.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validate()) return;
    setState({ status: "submitting", message: "" });
    try {
      const res = await fetch("/api/partners/cpa-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, serviceNeeds }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setState({
          status: "error",
          message: data.error || "Something went wrong. Please try again shortly.",
        });
        return;
      }
      setState({
        status: "success",
        message:
          "Application received. PK reviews every application personally and will follow up by email. No work starts until you accept a written quote.",
      });
    } catch {
      setState({
        status: "error",
        message: "Something went wrong. Please try again shortly.",
      });
    }
  }

  if (state.status === "success") {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <h3 className="text-2xl">Application received.</h3>
        <p className="mx-auto mt-3 max-w-xl leading-relaxed text-muted-gray">{state.message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="rounded-xl border border-border bg-card p-6 sm:p-8">
      <div className="grid gap-5 md:grid-cols-2">
        <label className={labelClass}>
          Firm name <span aria-hidden="true" className="text-pink">*</span>
          <input
            className={inputClass}
            type="text"
            name="firmName"
            autoComplete="organization"
            value={form.firmName}
            onChange={(e) => update("firmName", e.target.value)}
            required
          />
          {fieldErrors.firmName ? (
            <span className="mt-1 block text-xs text-red-600">{fieldErrors.firmName}</span>
          ) : null}
        </label>
        <label className={labelClass}>
          Authorized contact name <span aria-hidden="true" className="text-pink">*</span>
          <input
            className={inputClass}
            type="text"
            name="contactName"
            autoComplete="name"
            value={form.contactName}
            onChange={(e) => update("contactName", e.target.value)}
            required
          />
          {fieldErrors.contactName ? (
            <span className="mt-1 block text-xs text-red-600">{fieldErrors.contactName}</span>
          ) : null}
        </label>
        <label className={labelClass}>
          Business email <span aria-hidden="true" className="text-pink">*</span>
          <input
            className={inputClass}
            type="email"
            name="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            required
          />
          {fieldErrors.email ? (
            <span className="mt-1 block text-xs text-red-600">{fieldErrors.email}</span>
          ) : null}
        </label>
        <label className={labelClass}>
          Phone (optional)
          <input
            className={inputClass}
            type="tel"
            name="phone"
            autoComplete="tel"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
          />
          {fieldErrors.phone ? (
            <span className="mt-1 block text-xs text-red-600">{fieldErrors.phone}</span>
          ) : null}
        </label>
      </div>

      <fieldset className="mt-6">
        <legend className={labelClass}>
          What does your firm need? <span aria-hidden="true" className="text-pink">*</span>
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {CPA_SERVICE_NEED_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex min-h-12 items-center gap-3 rounded-md border border-border px-4 py-2 text-sm"
            >
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={serviceNeeds.includes(option.value)}
                onChange={() => toggleService(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
        {fieldErrors.serviceNeeds ? (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.serviceNeeds}</p>
        ) : null}
      </fieldset>

      <fieldset className="mt-6">
        <legend className={labelClass}>
          How would you like to work together? <span aria-hidden="true" className="text-pink">*</span>
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {CPA_PARTNERSHIP_MODEL_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex min-h-12 items-center gap-3 rounded-md border border-border px-4 py-2 text-sm"
            >
              <input
                type="radio"
                name="partnershipModel"
                className="h-5 w-5"
                checked={form.partnershipModel === option.value}
                onChange={() => update("partnershipModel", option.value)}
                required
              />
              {option.label}
            </label>
          ))}
        </div>
        {fieldErrors.partnershipModel ? (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.partnershipModel}</p>
        ) : null}
      </fieldset>

      <label className={`${labelClass} mt-6 block`}>
        Brief scope (non-sensitive) <span aria-hidden="true" className="text-pink">*</span>
        <textarea
          className={inputClass}
          rows={4}
          name="scopeNotes"
          value={form.scopeNotes}
          onChange={(e) => update("scopeNotes", e.target.value)}
          placeholder="For example: 15 monthly bookkeeping clients, QuickBooks Online, need reconciliations and month-end close support. Do not include client names or taxpayer details."
          required
        />
        <span className="mt-1 block text-xs text-muted-gray">
          Keep it general. No client names, taxpayer details, or documents here.
        </span>
        {fieldErrors.scopeNotes ? (
          <span className="mt-1 block text-xs text-red-600">{fieldErrors.scopeNotes}</span>
        ) : null}
      </label>

      {/* Honeypot: visually hidden, real users never see or fill it. */}
      <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
        <label>
          Website
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={(e) => update("website", e.target.value)}
          />
        </label>
      </div>

      <label className="mt-6 flex items-start gap-3 rounded-md border border-border bg-secondary px-4 py-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-5 w-5"
          checked={form.acknowledgement}
          onChange={(e) => update("acknowledgement", e.target.checked)}
          required
        />
        <span>{CPA_ACKNOWLEDGEMENT_LABEL}</span>
      </label>
      {fieldErrors.acknowledgement ? (
        <p className="mt-1 text-xs text-red-600">{fieldErrors.acknowledgement}</p>
      ) : null}

      {state.status === "error" ? (
        <p className="mt-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={state.status === "submitting"}
        className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-md bg-pink px-7 py-3 font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-60 sm:w-auto"
      >
        {state.status === "submitting" ? "Submitting..." : "Submit application"}
      </button>
      <p className="mt-3 text-xs text-muted-gray">
        Submitting is not an engagement. PK reviews every application and follows up personally.
      </p>
    </form>
  );
}
