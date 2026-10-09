"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
type Doc = {
  id: string;
  canView: boolean;
  category: string;
  state: string;
  legalHold: boolean;
  disposalState: string;
  highRisk: boolean;
  taxInformation: boolean;
};
type Engagement = { id: string; label: string };
const control =
  "min-h-12 w-full rounded-md border border-white/30 bg-black px-3 py-2 text-white focus-visible:outline-2 focus-visible:outline-pink-400";
export default function VaultPage() {
  const [clientId, setClientId] = useState("");
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [requestId, setRequestId] = useState("");
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [message, setMessage] = useState(
    "Select an authorized client in Account security before using the Vault.",
  );
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState("");
  const blob = useRef("");
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const context = await fetch("/api/auth/client-context", {
        cache: "no-store",
      });
      if (!context.ok) return;
      const { activeClientId } = await context.json();
      if (!activeClientId) return;
      const response = await fetch("/api/vault", {
        cache: "no-store",
        headers: { "x-pk-client-context": activeClientId },
      });
      const data = await response.json();
      if (!cancelled) {
        setClientId(activeClientId);
        setEngagements(data.engagements || []);
        setMessage(
          response.ok
            ? "Synthetic demonstration only. Do not upload real client documents."
            : data.error || "Vault unavailable",
        );
      }
    }
    load().catch(() => {
      if (!cancelled) setMessage("Vault unavailable. Please try again.");
    });
    return () => {
      cancelled = true;
      if (blob.current) URL.revokeObjectURL(blob.current);
    };
  }, []);
  async function reload(id: string) {
    const response = await fetch(
      `/api/vault?requestId=${encodeURIComponent(id)}`,
      { cache: "no-store", headers: { "x-pk-client-context": clientId } },
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Cannot access documents");
    setDocuments(data.documents);
  }
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Vault operation failed",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file") as File;
    if (!file?.size || !requestId) return;
    await action(async () => {
      const response = await fetch("/api/vault", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-pk-client-context": clientId,
        },
        body: JSON.stringify({
          requestId,
          idempotencyKey: crypto.randomUUID(),
          purpose: data.get("purpose"),
          category: data.get("category"),
          retentionCategory: data.get("retentionCategory"),
          highRisk: data.get("highRisk") === "on",
          taxInformation: data.get("taxInformation") === "on",
          size: file.size,
          mimeType: file.type,
        }),
      });
      const intent = await response.json();
      if (!response.ok)
        throw new Error(intent.error || "Upload not authorized");
      const uploaded = await fetch(`/api/vault/${intent.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
          "x-pk-client-context": clientId,
          "x-vault-extension": file.name.split(".").pop()?.toLowerCase() || "",
        },
        body: file,
      });
      const result = await uploaded.json();
      if (!uploaded.ok) throw new Error(result.error || "Upload failed");
      setMessage(
        `Document status: ${result.state}. Downloads are available only after security release.`,
      );
      form.reset();
      await reload(requestId);
    });
  }
  async function open(doc: Doc, view: boolean) {
    await action(async () => {
      const response = await fetch(
        `/api/vault/${doc.id}${view ? "?view=true" : ""}`,
        { cache: "no-store", headers: { "x-pk-client-context": clientId } },
      );
      if (!response.ok)
        throw new Error((await response.json()).error || "Access denied");
      if (blob.current) URL.revokeObjectURL(blob.current);
      const url = URL.createObjectURL(await response.blob());
      blob.current = url;
      if (view) setPreview(url);
      else {
        const link = document.createElement("a");
        link.href = url;
        link.download = "secure-document";
        link.click();
        setPreview("");
        setMessage(
          "Download complete. Keep only approved copies on your device and remove them when no longer needed.",
        );
        setTimeout(() => {
          URL.revokeObjectURL(url);
          if (blob.current === url) blob.current = "";
        }, 60_000);
      }
    });
  }
  return (
    <div className="mx-auto my-6 max-w-4xl space-y-6 rounded-xl bg-zinc-950 px-5 py-10 text-white">
      <p className="text-sm font-semibold text-pink-400">
        PK BUSINESS SERVICES · CONFIDENTIAL WORKSPACE
      </p>
      <h1 className="text-3xl font-semibold">Secure Client Vault</h1>
      <p className="rounded-md border border-pink-400 p-4 font-semibold">
        Synthetic demonstration only. Real client documents are prohibited in
        this environment.
      </p>
      <p>
        Retain a PK copy only for a documented engagement or compliance need.
        TaxSmart and QuickBooks remain the authoritative systems where
        applicable.
      </p>
      <div className="flex flex-wrap gap-5">
        <Link
          href="/security"
          className="inline-flex min-h-12 items-center underline"
        >
          Account security &amp; client selection
        </Link>
        <Link
          href="/portal/documents"
          className="inline-flex min-h-12 items-center underline"
        >
          Ordinary PK documents
        </Link>
      </div>
      <p
        role="status"
        className="rounded-md border border-amber-400/50 bg-amber-400/10 p-4"
      >
        {message}
      </p>
      <label className="block space-y-2">
        <span>Engagement</span>
        <select
          aria-label="Engagement"
          className={control}
          value={requestId}
          disabled={busy || !engagements.length}
          onChange={(e) => {
            const id = e.target.value;
            setRequestId(id);
            setDocuments([]);
            if (id) void action(() => reload(id));
          }}
        >
          <option value="">Choose the engagement</option>
          {engagements.map((e, index) => (
            <option key={e.id} value={e.id}>
              {e.label} · {index + 1}
            </option>
          ))}
        </select>
      </label>
      <form
        onSubmit={submit}
        className="space-y-4 rounded-lg border border-white/20 p-5"
      >
        <h2 className="text-xl font-semibold">Retain a document</h2>
        <p className="text-sm">
          PDF, PNG or JPEG · maximum 10 MB. Files remain inaccessible until
          validation and security checks pass.
        </p>
        <p className="text-sm">
          Tax, identity and authorization documents require high-risk
          classification. Tax documents also require the tax return information
          flag.
        </p>
        <fieldset disabled={busy || !requestId} className="space-y-4">
          <label className="block space-y-2">
            <span>Why does PK need a copy?</span>
            <select
              aria-label="Why does PK need a copy?"
              name="purpose"
              className={control}
              required
            >
              <option value="REQUIRED_ENGAGEMENT_RECORD">
                Required engagement record
              </option>
              <option value="APPROVED_COMPLIANCE_COPY">
                Approved compliance copy
              </option>
              <option value="VENDOR_UNAVAILABLE_HANDOFF">
                Approved handoff while vendor unavailable
              </option>
            </select>
          </label>
          <label className="block space-y-2">
            <span>Document category</span>
            <select
              aria-label="Document category"
              name="category"
              className={control}
            >
              <option value="BOOKKEEPING">Bookkeeping</option>
              <option value="TAX">Tax</option>
              <option value="IDENTITY">Identity</option>
              <option value="AUTHORIZATION">Authorization</option>
              <option value="OTHER_CONFIDENTIAL">Other confidential</option>
            </select>
          </label>
          <label className="block space-y-2">
            <span>Retention category</span>
            <select
              aria-label="Retention category"
              name="retentionCategory"
              className={control}
            >
              <option value="ENGAGEMENT">Engagement record</option>
              <option value="BOOKKEEPING_SOURCE">Bookkeeping source</option>
              <option value="TAX_SOURCE">Tax source</option>
              <option value="AUTHORIZATION">Authorization</option>
              <option value="COMPLIANCE">Compliance</option>
            </select>
          </label>
          <label className="flex min-h-12 items-center gap-3">
            <input name="highRisk" type="checkbox" className="h-6 w-6" />
            High-risk client data
          </label>
          <label className="flex min-h-12 items-center gap-3">
            <input name="taxInformation" type="checkbox" className="h-6 w-6" />
            Tax return information
          </label>
          <label className="block space-y-2">
            <span>Synthetic document</span>
            <input
              className={control}
              name="file"
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              required
            />
          </label>
          <button
            className="min-h-12 rounded-md bg-pink-600 px-5 font-semibold text-white focus-visible:outline-2 focus-visible:outline-white"
            type="submit"
          >
            Upload for security checks
          </button>
        </fieldset>
      </form>
      <section aria-labelledby="documents-title" className="space-y-4">
        <h2 id="documents-title" className="text-xl font-semibold">
          Vault documents
        </h2>
        {documents.length === 0 && <p>No authorized documents to display.</p>}
        {documents.map((doc) => (
          <article
            key={doc.id}
            className="space-y-3 rounded-lg border border-white/20 p-4"
          >
            <h3 className="font-semibold">
              {doc.category.replaceAll("_", " ")}
            </h3>
            <p className="text-sm">
              {doc.state.replaceAll("_", " ")}
              {doc.legalHold ? " · Legal hold" : ""}
              {doc.highRisk ? " · High risk" : ""}
              {doc.taxInformation ? " · Tax return information" : ""}
            </p>
            {doc.state === "RELEASED" && doc.disposalState === "NONE" && (
              <div className="flex flex-wrap gap-3">
                {doc.canView && (
                  <button
                    disabled={busy}
                    className="min-h-12 rounded-md border px-4"
                    onClick={() => open(doc, true)}
                  >
                    View image securely
                  </button>
                )}
                <button
                  disabled={busy}
                  className="min-h-12 rounded-md border px-4"
                  onClick={() => open(doc, false)}
                >
                  Download approved copy
                </button>
              </div>
            )}
          </article>
        ))}
      </section>
      {preview && (
        <section aria-label="Secure image preview">
          <button
            className="mb-3 min-h-12 rounded-md border px-4"
            onClick={() => {
              URL.revokeObjectURL(blob.current);
              blob.current = "";
              setPreview("");
            }}
          >
            Close preview
          </button>
          {/* Unoptimized Blob image stays in memory and never enters Next image proxy/cache. */}
          <Image
            unoptimized
            width={1200}
            height={1600}
            src={preview}
            alt="Authorized confidential document preview"
            className="h-auto max-w-full"
          />
        </section>
      )}
    </div>
  );
}
