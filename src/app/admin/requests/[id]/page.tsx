"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";

type Detail = {
  id: string;
  client: { id: string; name: string };
  service: string;
  requestType: string;
  status: string;
  clientNotes: string | null;
  requesterName: string | null;
  assignedStaff: { id: string; name: string; email: string } | null;
  documents: { id: string; fileName: string; reviewStatus: string; createdAt: string }[];
  documentRequests: { id: string; title: string; status: string; required: boolean }[];
  messages: { id: string; body: string; isFromStaff: boolean; authorName: string; createdAt: string }[];
  internalNotes: { id: string; content: string; authorName: string; createdAt: string }[];
};

type Staff = { id: string; name: string; email: string; role: string };

const STATUSES = [
  "DRAFT", "SUBMITTED", "DOCUMENTS_REQUIRED", "UNDER_REVIEW",
  "VERIFICATION_IN_PROGRESS", "COMPLETED", "REJECTED", "CANCELLED",
];

export default function AdminRequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [note, setNote] = useState("");
  const [reply, setReply] = useState("");
  const [docReqTitle, setDocReqTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch(`/api/admin/requests/${id}`);
    if (res.ok) setDetail(await res.json());
  }

  useEffect(() => {
    load();
    fetch("/api/admin/staff").then((r) => (r.ok ? r.json() : [])).then(setStaff).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function patch(data: Record<string, unknown>) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Update failed");
      } else {
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function addNote() {
    if (!note.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/requests/${id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: note }),
      });
      if (res.ok) { setNote(""); await load(); }
    } finally { setSaving(false); }
  }

  async function sendReply() {
    if (!reply.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/requests/${id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply }),
      });
      if (res.ok) { setReply(""); await load(); }
    } finally { setSaving(false); }
  }

  async function addDocRequest() {
    if (!docReqTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/requests/${id}/document-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: docReqTitle }),
      });
      if (res.ok) { setDocReqTitle(""); await load(); }
    } finally { setSaving(false); }
  }

  if (!detail) return <p className="p-8 text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/requests" className="text-sm text-muted-foreground hover:underline">← All requests</Link>
        <h1 className="mt-2 text-2xl font-semibold">{detail.requestType || detail.service}</h1>
        <p className="text-sm text-muted-foreground">
          {detail.client.name} · {detail.service} · Requested by {detail.requesterName || "—"}
        </p>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200">{error}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <h2 className="font-medium">Manage</h2>
          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <select
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={detail.status}
              disabled={saving}
              onChange={(e) => patch({ status: e.target.value })}
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Assigned staff</label>
            <select
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={detail.assignedStaff?.id || ""}
              disabled={saving}
              onChange={(e) => patch({ assignedStaffId: e.target.value || null })}
            >
              <option value="">Unassigned</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
            </select>
          </div>
          {detail.clientNotes && (
            <div>
              <label className="text-xs text-muted-foreground">Client notes</label>
              <p className="mt-1 rounded-md bg-muted p-3 text-sm">{detail.clientNotes}</p>
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-3">
          <h2 className="font-medium">Documents</h2>
          {detail.documents.length === 0 && <p className="text-sm text-muted-foreground">No documents uploaded.</p>}
          <ul className="space-y-1 text-sm">
            {detail.documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                <span className="truncate">{d.fileName}</span>
                <span className="text-xs text-muted-foreground">{d.reviewStatus}</span>
              </li>
            ))}
          </ul>
          <h3 className="pt-2 text-sm font-medium">Requested documents</h3>
          <ul className="space-y-1 text-sm">
            {detail.documentRequests.map((dr) => (
              <li key={dr.id} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                <span>{dr.title}{dr.required && <span className="text-red-500"> *</span>}</span>
                <span className="text-xs text-muted-foreground">{dr.status}</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Request a document…"
              value={docReqTitle}
              onChange={(e) => setDocReqTitle(e.target.value)}
            />
            <button onClick={addDocRequest} disabled={saving || !docReqTitle.trim()}
              className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              Add
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="font-medium">Client messages</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {detail.messages.length === 0 && <li className="text-muted-foreground">No messages.</li>}
          {detail.messages.map((m) => (
            <li key={m.id} className={`rounded-md p-3 ${m.isFromStaff ? "bg-primary/10" : "bg-muted"}`}>
              <p>{m.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">{m.authorName} · {new Date(m.createdAt).toLocaleString()}</p>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <input
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Reply to client…"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          <button onClick={sendReply} disabled={saving || !reply.trim()}
            className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            Send
          </button>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="font-medium">Internal notes <span className="text-xs font-normal text-muted-foreground">(never visible to clients)</span></h2>
        <ul className="mt-3 space-y-2 text-sm">
          {detail.internalNotes.map((n) => (
            <li key={n.id} className="rounded-md border-l-4 border-amber-400 bg-amber-50 p-3">
              <p>{n.content}</p>
              <p className="mt-1 text-xs text-muted-foreground">{n.authorName} · {new Date(n.createdAt).toLocaleString()}</p>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <input
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Add internal note…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button onClick={addNote} disabled={saving || !note.trim()}
            className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
