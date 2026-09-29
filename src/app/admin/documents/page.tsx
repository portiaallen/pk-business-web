"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FolderOpen,
  Download,
  Search,
  Filter,
  FileText,
  ChevronDown,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirmDelete } from "@/lib/confirm-delete";

type Document = {
  id: string;
  fileName: string;
  category: string;
  uploadStatus: string;
  reviewStatus: string;
  fileSizeBytes: number;
  clientId: string;
  clientName: string;
  requestId: string;
  requestTitle: string;
  createdAt: string;
};

type Client = { id: string; name: string };

const CATEGORIES = ["IDENTITY", "INCOME", "EMPLOYMENT", "BUSINESS", "TAX", "BANKING", "OTHER"];
const REVIEW_STATUSES = ["PENDING", "APPROVED", "REJECTED", "NEEDS_REVISION", "UNDER_REVIEW", "ACCEPTED", "CHANGES_REQUESTED", "COMPLETED"];
const UPLOAD_STATUSES = ["PENDING", "UPLOADED", "FAILED"];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminDocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [reviewFilter, setReviewFilter] = useState("");
  const [uploadFilter, setUploadFilter] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  async function handleDelete(d: Document) {
    if (!confirmDelete(`Permanently delete "${d.fileName}" and its stored file? This cannot be undone.`)) return;
    setDeletingId(d.id);
    setActionError("");
    try {
      const res = await fetch("/api/admin/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: d.id }),
      });
      if (res.ok) {
        setDocuments((prev) => prev.filter((x) => x.id !== d.id));
      } else {
        const data = await res.json().catch(() => ({}));
        setActionError(data.error || `Delete failed (${res.status})`);
      }
    } catch {
      setActionError("Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    async function fetchData() {
      try {
        const [docsRes, clientsRes] = await Promise.all([
          fetch("/api/admin/documents"),
          fetch("/api/admin/clients"),
        ]);
        if (docsRes.ok) setDocuments(await docsRes.json());
        if (clientsRes.ok) setClients(await clientsRes.json());
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filtered = documents.filter((d) => {
    const matchSearch = !search ||
      d.fileName.toLowerCase().includes(search.toLowerCase()) ||
      d.clientName.toLowerCase().includes(search.toLowerCase()) ||
      d.requestTitle.toLowerCase().includes(search.toLowerCase());
    const matchClient = !clientFilter || d.clientId === clientFilter;
    const matchCategory = !categoryFilter || d.category === categoryFilter;
    const matchReview = !reviewFilter || d.reviewStatus === reviewFilter;
    const matchUpload = !uploadFilter || d.uploadStatus === uploadFilter;
    return matchSearch && matchClient && matchCategory && matchReview && matchUpload;
  });

  const clientOptions = [
    { value: "", label: "All clients" },
    ...clients.map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-charcoal">Documents</h1>
        <p className="mt-2 text-muted-gray">
          All documents uploaded by clients across all engagements.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-gray" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
          />
        </div>
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="h-10 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 min-w-[180px]"
        >
          {clientOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-10 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 min-w-[140px]"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={reviewFilter}
          onChange={(e) => setReviewFilter(e.target.value)}
          className="h-10 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 min-w-[160px]"
        >
          <option value="">All review statuses</option>
          {REVIEW_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
        <Button
          variant="outline"
          onClick={() => { setClientFilter(""); setCategoryFilter(""); setReviewFilter(""); setUploadFilter(""); setSearch(""); }}
          className="min-h-10"
        >
          <Filter className="size-4" /> Clear filters
        </Button>
      </div>

      {actionError && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {actionError}
        </p>
      )}

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-gray">Loading documents...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center">
          <FolderOpen className="mx-auto size-10 text-muted-gray/40" />
          <h3 className="mt-3 font-heading text-lg font-semibold text-charcoal">No documents found</h3>
          {documents.length === 0 ? (
            <p className="mt-1 text-sm text-muted-gray">Documents will appear here when clients upload them.</p>
          ) : (
            <p className="mt-1 text-sm text-muted-gray">Try adjusting your filters.</p>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-cream">
              <tr>
                <th className="px-4 py-3 font-semibold text-charcoal">File</th>
                <th className="px-4 py-3 font-semibold text-charcoal">Client</th>
                <th className="px-4 py-3 font-semibold text-charcoal">Request</th>
                <th className="px-4 py-3 font-semibold text-charcoal">Category</th>
                <th className="px-4 py-3 font-semibold text-charcoal">Status</th>
                <th className="px-4 py-3 font-semibold text-charcoal">Size</th>
                <th className="px-4 py-3 font-semibold text-charcoal">Uploaded</th>
                <th className="px-4 py-3 font-semibold text-charcoal" colSpan={2}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-cream/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="size-4 shrink-0 text-muted-gray" />
                      <span className="font-medium text-charcoal truncate max-w-[200px]">{d.fileName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/clients/${d.clientId}`} className="text-charcoal hover:text-gold">
                      {d.clientName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/requests/${d.requestId}`} className="text-muted-foreground hover:text-charcoal truncate max-w-[150px] block">
                      {d.requestTitle}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{d.category}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        d.reviewStatus === "APPROVED" ? "bg-green-50 text-green-700" :
                        d.reviewStatus === "REJECTED" ? "bg-red-50 text-red-700" :
                        d.reviewStatus === "NEEDS_REVISION" ? "bg-amber-50 text-amber-700" :
                        "bg-amber-50 text-amber-700"
                      }`}>
                        {d.reviewStatus}
                      </span>
                      <span className={`text-[10px] text-muted-foreground ${
                        d.uploadStatus === "UPLOADED" ? "text-green-600" :
                        d.uploadStatus === "PENDING" ? "text-amber-600" :
                        "text-red-600"
                      }`}>
                        {d.uploadStatus}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatSize(d.fileSizeBytes)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(d.createdAt)}</td>
                  <td className="px-4 py-3">
                    {d.uploadStatus === "UPLOADED" && (
                      <a
                        href={`/api/portal/documents/${d.id}`}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center gap-1 text-charcoal hover:text-gold text-sm"
                      >
                        <Download className="size-3.5" /> Download
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(d)}
                      disabled={deletingId === d.id}
                      aria-label={`Delete ${d.fileName}`}
                      className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-sm font-medium text-red-800 transition-colors hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className="size-3.5" /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 0 && (
            <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
              Showing {filtered.length} of {documents.length} documents
            </div>
          )}
        </div>
      )}
    </div>
  );
}
