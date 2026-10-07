"use client";
import { useState } from "react";
import { RELATIONSHIPS, type LibraryInput } from "@/lib/readiness/policy";
import { human } from "./client";
export const blankRecommendation: LibraryInput = {
  title: "",
  category: "",
  recommendationType: "PROFESSIONAL_TYPE",
  providerOrResourceName: null,
  clientFacingDescription: "",
  whyOrWhenToUse: "",
  clientNextStep: "",
  websiteUrl: null,
  phone: null,
  email: null,
  locationOrServiceArea: null,
  internalNotes: "",
  relationshipClassification: "INFORMATIONAL",
  disclosureText: "",
  active: true,
  archived: false,
};
export function RecommendationEditor({
  initial = blankRecommendation,
  busy,
  onSave,
  submitLabel = "Save recommendation",
}: {
  initial?: LibraryInput;
  busy: boolean;
  onSave: (entry: LibraryInput) => void;
  submitLabel?: string;
}) {
  const [relationship, setRelationship] = useState(
    initial.relationshipClassification,
  );
  const [preview, setPreview] = useState<LibraryInput | null>(null);
  function fields(form: HTMLFormElement) {
    const data = new FormData(form);
    const value: Record<string, unknown> = {};
    for (const key of Object.keys(blankRecommendation)) {
      if (["active", "archived"].includes(key))
        value[key] = data.get(key) === "on";
      else if (
        [
          "providerOrResourceName",
          "websiteUrl",
          "phone",
          "email",
          "locationOrServiceArea",
        ].includes(key)
      )
        value[key] = String(data.get(key) || "").trim() || null;
      else value[key] = String(data.get(key) || "");
    }
    if (value.archived) value.active = false;
    return value as LibraryInput;
  }
  const textFields = [
    ["title", "Title", true],
    ["category", "Category", true],
    ["providerOrResourceName", "Provider or resource name (optional)", false],
    ["clientFacingDescription", "Client-facing description", true],
    ["whyOrWhenToUse", "Why or when to use", true],
    ["clientNextStep", "Client next step", true],
    ["websiteUrl", "Website (HTTPS, no tracking parameters)", false],
    ["phone", "Phone (optional)", false],
    ["email", "Email (optional)", false],
    ["locationOrServiceArea", "Location or service area (optional)", false],
    [
      "disclosureText",
      "Relationship disclosure",
      relationship !== "INFORMATIONAL",
    ],
    [
      "internalNotes",
      "Internal notes — never included in the client report",
      false,
    ],
  ] as const;
  return (
    <form
      className="space-y-4 rounded border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(fields(event.currentTarget));
      }}
    >
      <p>
        Named resources are optional. Select a relationship deliberately; an
        entry does not establish that a provider is vetted or partnered. Do not
        invent credentials, pricing, availability or outcomes.
      </p>
      <label className="block">
        Recommendation type
        <select
          className="mt-1 min-h-12 w-full rounded border p-3"
          name="recommendationType"
          defaultValue={initial.recommendationType}
        >
          {[
            "PROFESSIONAL_TYPE",
            "SERVICE_TYPE",
            "NAMED_PROVIDER",
            "RESOURCE",
          ].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      <label className="block">
        Relationship classification
        <select
          className="mt-1 min-h-12 w-full rounded border p-3"
          name="relationshipClassification"
          value={relationship}
          onChange={(event) =>
            setRelationship(
              event.target.value as LibraryInput["relationshipClassification"],
            )
          }
        >
          {RELATIONSHIPS.map((value) => (
            <option key={value} value={value}>
              {human(value)}
            </option>
          ))}
        </select>
      </label>
      {textFields.map(([key, label, required]) => (
        <label key={key} className="block">
          {label}
          {[
            "clientFacingDescription",
            "whyOrWhenToUse",
            "clientNextStep",
            "disclosureText",
            "internalNotes",
          ].includes(key) ? (
            <textarea
              className="mt-1 block w-full rounded border p-3"
              name={key}
              defaultValue={String(initial[key] || "")}
              required={required}
              maxLength={4000}
              rows={3}
            />
          ) : (
            <input
              className="mt-1 block min-h-12 w-full rounded border p-3"
              name={key}
              defaultValue={String(initial[key] || "")}
              required={required}
              maxLength={key === "websiteUrl" ? 2048 : 160}
              type={
                key === "email"
                  ? "email"
                  : key === "websiteUrl"
                    ? "url"
                    : "text"
              }
            />
          )}
        </label>
      ))}
      <label className="flex min-h-10 items-center gap-3">
        <input name="active" type="checkbox" defaultChecked={initial.active} />
        Active for future selection
      </label>
      <label className="flex min-h-10 items-center gap-3">
        <input
          name="archived"
          type="checkbox"
          defaultChecked={initial.archived}
        />
        Archive
      </label>
      <div className="flex flex-wrap gap-3">
        <button
          className="rounded bg-pink-700 px-4 py-3 text-white"
          disabled={busy}
        >
          {submitLabel}
        </button>
        <button
          type="button"
          className="rounded border px-4 py-3"
          onClick={(event) => setPreview(fields(event.currentTarget.form!))}
        >
          Preview client-facing copy
        </button>
      </div>
      {preview && (
        <aside className="space-y-2 rounded border bg-white p-4">
          <h3 className="font-semibold">
            {preview.title} {preview.providerOrResourceName}
          </h3>
          <p>{preview.clientFacingDescription}</p>
          <p>{preview.whyOrWhenToUse}</p>
          <p>{preview.clientNextStep}</p>
          <p>
            {human(preview.relationshipClassification)}:{" "}
            {preview.disclosureText ||
              "Informational resource only. PK has not verified this resource. No outcome is guaranteed."}
          </p>
          <p>{preview.websiteUrl}</p>
          <p>
            {preview.phone} {preview.email} {preview.locationOrServiceArea}
          </p>
        </aside>
      )}
    </form>
  );
}
