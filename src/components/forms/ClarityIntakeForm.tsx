"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  clarityIntakeDefinition,
  type ClarityIntakeDefinition,
  type ClarityIntakeQuestion,
} from "@/content/clarity-intake";

const selectClassName =
  "flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

interface Props {
  productId: string;
}

type AnswerValue = string | string[] | Record<string, string>[];

export function ClarityIntakeForm({ productId }: Props) {
  const definition: ClarityIntakeDefinition | null = clarityIntakeDefinition(productId);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [contactMethod, setContactMethod] = useState("email");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!definition) return null;
  const def = definition as ClarityIntakeDefinition;

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};
    if (!fullName.trim()) next.fullName = "Full name is required.";
    if (!email.trim()) {
      next.email = "Email is required.";
    } else if (!validateEmail(email)) {
      next.email = "Please enter a valid email address.";
    }
    for (const question of def.questions) {
      const value = answers[question.id];
      if (question.type === "entry-list") {
        const entries = Array.isArray(value) ? value : [];
        if (question.required && entries.length === 0) {
          next[question.id] = "Add at least one entry.";
        }
      } else if (question.type === "checkbox") {
        const values = Array.isArray(value) ? value : [];
        if (question.required && values.length === 0) {
          next[question.id] = "Select at least one option.";
        }
      } else if (question.required && !(typeof value === "string" && value.trim())) {
        next[question.id] = "This answer is required.";
      }
    }
    return next;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/clarity/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: def.productId,
          fullName,
          email,
          phone,
          businessName: def.collectBusinessName ? businessName : "",
          contactMethod,
          marketingOptIn,
          answers,
        }),
      });
      if (response.ok) {
        setSubmitted(true);
      } else {
        let message = "Something went wrong. Please try again.";
        try {
          const payload = await response.json();
          if (payload?.error) message = payload.error;
          if (payload?.details && Array.isArray(payload.details)) {
            message = payload.details.join(" ");
          }
        } catch {
          // keep the fallback message
        }
        setFormError(message);
      }
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-lg border border-gold/40 bg-cream p-6">
        <h3 className="pk-heading text-lg font-semibold text-charcoal">Intake received</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-gray">
          Thank you. PK has your {def.productId === "deduction-hunter-personal" ? "personal deduction" : "product"} intake and will follow up by email with
          next steps. Documents never come through this form; PK shares the secure
          upload process with you directly.
        </p>
      </div>
    );
  }

  function setAnswer(id: string, value: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function renderQuestion(question: ClarityIntakeQuestion) {
    const value = answers[question.id];
    const error = errors[question.id];
    if (question.type === "text" || question.type === "longtext") {
      const common = {
        id: `clarity-${question.id}`,
        value: typeof value === "string" ? value : "",
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
          setAnswer(question.id, e.target.value),
        placeholder: question.placeholder,
      };
      return (
        <div key={question.id}>
          <Label htmlFor={`clarity-${question.id}`} className="mb-1.5 block text-sm font-medium text-charcoal">
            {question.label}
            {question.required ? " *" : ""}
          </Label>
          {question.type === "text" ? <Input {...common} /> : <Textarea rows={3} {...common} />}
          {question.help && <p className="mt-1 text-xs text-muted-gray">{question.help}</p>}
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
      );
    }
    if (question.type === "select") {
      return (
        <div key={question.id}>
          <Label htmlFor={`clarity-${question.id}`} className="mb-1.5 block text-sm font-medium text-charcoal">
            {question.label} {question.required ? "*" : ""}
          </Label>
          <select
            id={`clarity-${question.id}`}
            className={selectClassName}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => setAnswer(question.id, e.target.value)}
          >
            <option value="">Select one</option>
            {(question.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {question.help && <p className="mt-1 text-xs text-muted-gray">{question.help}</p>}
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
      );
    }
    if (question.type === "checkbox") {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div key={question.id}>
          <span className="mb-1.5 block text-sm font-medium text-charcoal">
            {question.label} {question.required ? "*" : ""}
          </span>
          <div className="grid gap-2 sm:grid-cols-2">
            {(question.options ?? []).map((option) => (
              <label key={option} className="flex items-start gap-2 text-sm text-muted-gray">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.includes(option)}
                  onChange={(e) =>
                    setAnswer(
                      question.id,
                      e.target.checked ? [...selected, option] : selected.filter((item) => item !== option)
                    )
                  }
                />
                {option}
              </label>
            ))}
          </div>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
      );
    }
    // entry-list
    const entries = (Array.isArray(value) ? value : []) as Record<string, string>[];
    const max = question.maxEntries ?? 25;
    const fields = question.entryFields ?? [];
    return (
      <div key={question.id}>
        <span className="mb-1.5 block text-sm font-medium text-charcoal">
          {question.label} {question.required ? "*" : ""}{" "}
          <span className="text-xs font-normal text-muted-gray">({entries.length} of {max} entries)</span>
        </span>
        <div className="space-y-3">
          {entries.map((entry, index) => (
            <div key={index} className="rounded-lg border border-border bg-card p-3">
              <div className="grid gap-2 sm:grid-cols-3">
                {fields.map((field) => (
                  <div key={field.id}>
                    <Label htmlFor={`clarity-${question.id}-${index}-${field.id}`} className="mb-1 block text-xs text-muted-gray">
                      {field.label}
                      {field.required ? " *" : ""}
                    </Label>
                    {field.type === "number" ? (
                      <Input
                        id={`clarity-${question.id}-${index}-${field.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={entry[field.id] ?? ""}
                        onChange={(e) => {
                          const copy = [...entries];
                          copy[index] = { ...copy[index], [field.id]: e.target.value };
                          setAnswer(question.id, copy);
                        }}
                      />
                    ) : field.options ? (
                      <select
                        id={`clarity-${question.id}-${index}-${field.id}`}
                        className={selectClassName}
                        value={entry[field.id] ?? ""}
                        onChange={(e) => {
                          const copy = [...entries];
                          copy[index] = { ...copy[index], [field.id]: e.target.value };
                          setAnswer(question.id, copy);
                        }}
                      >
                        <option value="">Select one</option>
                        {field.options.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        id={`clarity-${question.id}-${index}-${field.id}`}
                        value={entry[field.id] ?? ""}
                        onChange={(e) => {
                          const copy = [...entries];
                          copy[index] = { ...copy[index], [field.id]: e.target.value };
                          setAnswer(question.id, copy);
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="mt-2 text-xs text-muted-gray underline hover:text-charcoal"
                onClick={() => setAnswer(question.id, entries.filter((_, i) => i !== index))}
              >
                Remove entry
              </button>
            </div>
          ))}
        </div>
        {entries.length < max && (
          <Button
            type="button"
            variant="outline"
            className="mt-2"
            onClick={() => setAnswer(question.id, [...entries, {}])}
          >
            Add entry
          </Button>
        )}
        {question.help && <p className="mt-1 text-xs text-muted-gray">{question.help}</p>}
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="clarity-fullname" className="mb-1.5 block text-sm font-medium text-charcoal">
            Full name *
          </Label>
          <Input
            id="clarity-fullname"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
          />
          {errors.fullName && <p className="mt-1 text-xs text-red-600">{errors.fullName}</p>}
        </div>
        <div>
          <Label htmlFor="clarity-email" className="mb-1.5 block text-sm font-medium text-charcoal">
            Email *
          </Label>
          <Input
            id="clarity-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
        </div>
        <div>
          <Label htmlFor="clarity-phone" className="mb-1.5 block text-sm font-medium text-charcoal">
            Phone (optional)
          </Label>
          <Input
            id="clarity-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
          />
        </div>
        {def.collectBusinessName && (
          <div>
            <Label htmlFor="clarity-businessname" className="mb-1.5 block text-sm font-medium text-charcoal">
              Business name (optional)
            </Label>
            <Input
              id="clarity-businessname"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              autoComplete="organization"
            />
          </div>
        )}
        <div>
          <Label htmlFor="clarity-contactmethod" className="mb-1.5 block text-sm font-medium text-charcoal">
            Best way to reach you
          </Label>
          <select
            id="clarity-contactmethod"
            className={selectClassName}
            value={contactMethod}
            onChange={(e) => setContactMethod(e.target.value)}
          >
            <option value="email">Email</option>
            <option value="phone">Phone</option>
            <option value="either">Either</option>
          </select>
        </div>
      </div>

      <div className="space-y-5 border-t border-border pt-5">
        {def.questions.map(renderQuestion)}
      </div>

      <label className="flex items-start gap-2 text-sm text-muted-gray">
        <input
          type="checkbox"
          className="mt-1"
          checked={marketingOptIn}
          onChange={(e) => setMarketingOptIn(e.target.checked)}
        />
        Send me occasional PK Business Services updates. Optional; never required.
      </label>

      <p className="text-xs leading-relaxed text-muted-gray">
        Never send Social Security numbers, ITINs, IP PINs, or bank details through
        this form. Sensitive information moves through PK&apos;s secure client process.
      </p>

      {formError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {formError}
        </div>
      )}

      <Button
        type="submit"
        disabled={submitting}
        className={cn("h-11 w-full bg-charcoal text-ivory hover:bg-charcoal/90")}
      >
        {submitting ? "Submitting…" : "Submit product intake"}
      </Button>
    </form>
  );
}
