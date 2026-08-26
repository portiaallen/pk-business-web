"use client";

import { useState, type FormEvent } from "react";
import { serviceOptions } from "@/content/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface FormData {
  fullName: string;
  email: string;
  phone: string;
  businessName: string;
  service: string;
  description: string;
  contactMethod: string;
}

interface FormErrors {
  fullName?: string;
  email?: string;
  service?: string;
  description?: string;
}

const initialFormData: FormData = {
  fullName: "",
  email: "",
  phone: "",
  businessName: "",
  service: "",
  description: "",
  contactMethod: "email",
};

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function ConsultationForm() {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): FormErrors {
    const newErrors: FormErrors = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = "Full name is required.";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required.";
    } else if (!validateEmail(formData.email)) {
      newErrors.email = "Please enter a valid email address.";
    }

    if (!formData.service) {
      newErrors.service = "Please select a service.";
    }

    if (!formData.description.trim()) {
      newErrors.description = "Please provide a brief description.";
    }

    return newErrors;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(false);

    const validationErrors = validate();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      const firstErrorId = Object.keys(validationErrors)[0];
      const fieldMap: Record<string, string> = {
        fullName: "fullName",
        email: "email",
        service: "service",
        description: "description",
      };
      const fieldId = fieldMap[firstErrorId];
      if (fieldId) {
        document.getElementById(fieldId)?.focus();
        document.getElementById(fieldId)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        setSubmitError(true);
        return;
      }

      setSubmitted(true);
      setFormData(initialFormData);
    } catch {
      setSubmitError(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateField<K extends keyof FormData>(
    field: K,
    value: FormData[K]
  ) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field as keyof FormErrors];
        return next;
      });
    }
  }

  if (submitted) {
    return (
      <div
        role="status"
        className="rounded-xl border border-gold/30 bg-gold/5 p-8 text-center"
      >
        <h2 className="font-heading text-2xl font-semibold text-charcoal">
          Thank You for Your Request
        </h2>
        <p className="mt-3 text-muted-gray">
          Your consultation request has been received. We will review your
          information and follow up using your preferred contact method.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-6"
          onClick={() => setSubmitted(false)}
        >
          Submit Another Request
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {Object.keys(errors).length > 0 && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          Please correct the highlighted fields below before submitting.
        </div>
      )}

      {submitError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          Something went wrong. Please try again later.
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fullName">
            Full Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="fullName"
            name="fullName"
            value={formData.fullName}
            onChange={(e) => updateField("fullName", e.target.value)}
            aria-invalid={!!errors.fullName}
            aria-describedby={errors.fullName ? "fullName-error" : undefined}
            className="h-11"
            autoComplete="name"
          />
          {errors.fullName && (
            <p id="fullName-error" className="text-sm text-destructive">
              {errors.fullName}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">
            Email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={(e) => updateField("email", e.target.value)}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            className="h-11"
            autoComplete="email"
          />
          {errors.email && (
            <p id="email-error" className="text-sm text-destructive">
              {errors.email}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            className="h-11"
            autoComplete="tel"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="businessName">Business Name (optional)</Label>
          <Input
            id="businessName"
            name="businessName"
            value={formData.businessName}
            onChange={(e) => updateField("businessName", e.target.value)}
            className="h-11"
            autoComplete="organization"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="service">
          Service Needed <span className="text-destructive">*</span>
        </Label>
        <select
          id="service"
          name="service"
          value={formData.service}
          onChange={(e) => updateField("service", e.target.value)}
          aria-invalid={!!errors.service}
          aria-describedby={errors.service ? "service-error" : undefined}
          className={cn(
            "flex h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            errors.service && "border-destructive ring-destructive/20"
          )}
        >
          <option value="">Select a service...</option>
          {serviceOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {errors.service && (
          <p id="service-error" className="text-sm text-destructive">
            {errors.service}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">
          Brief Description <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={(e) => updateField("description", e.target.value)}
          aria-invalid={!!errors.description}
          aria-describedby={
            errors.description ? "description-error" : undefined
          }
          rows={5}
          placeholder="Tell us about your situation and what you need help with..."
          className="min-h-[120px] resize-y"
        />
        {errors.description && (
          <p id="description-error" className="text-sm text-destructive">
            {errors.description}
          </p>
        )}
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Preferred Contact Method</legend>
        <div className="flex flex-wrap gap-4">
          {[
            { value: "email", label: "Email" },
            { value: "phone", label: "Phone" },
            { value: "either", label: "Either" },
          ].map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <input
                type="radio"
                name="contactMethod"
                value={option.value}
                checked={formData.contactMethod === option.value}
                onChange={(e) =>
                  updateField("contactMethod", e.target.value)
                }
                className="size-4 accent-charcoal"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="h-12 w-full bg-charcoal text-ivory hover:bg-charcoal/90 sm:w-auto sm:px-10"
      >
        {isSubmitting ? "Sending..." : "Request a Consultation"}
      </Button>
    </form>
  );
}
