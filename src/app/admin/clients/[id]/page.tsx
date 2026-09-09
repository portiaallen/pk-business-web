"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  Users,
  FileText,
  FolderOpen,
  MessageSquare,
  Activity,
  Clock,
  Edit,
  CheckCircle2,
  XCircle,
  PauseCircle,
  AlertCircle,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ClientDetail = {
  id: string;
  name: string;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  requestCount: number;
  members: Array<{
    id: string;
    userId: string;
    name: string;
    email: string;
    role: string;
    status: string;
    lastLoginAt: string | null;
  }>;
  requests: Array<{
    id: string;
    service: string;
    requestType: string;
    status: string;
    assignedStaff: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  documents: Array<{
    id: string;
    fileName: string;
    category: string;
    uploadStatus: string;
    reviewStatus: string;
    requestTitle: string;
    requestId: string;
    createdAt: string;
  }>;
  messages: Array<{
    id: string;
    body: string;
    isFromStaff: boolean;
    authorName: string;
    authorRole: string;
    requestTitle: string;
    requestId: string;
    createdAt: string;
  }>;
  activity: Array<{
    id: string;
    action: string;
    resource: string;
    resourceId: string | null;
    actorName: string | null;
    metadata: string;
    createdAt: string;
  }>;
};

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active", icon: CheckCircle2, color: "bg-green-50 text-green-700 border border-green-200" },
  { value: "INACTIVE", label: "Inactive", icon: PauseCircle, color: "bg-amber-50 text-amber-700 border border-amber-200" },
  { value: "ARCHIVED", label: "Archived", icon: XCircle, color: "bg-muted text-muted-foreground" },
];

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SUBMITTED: "bg-blue-50 text-blue-700 border border-blue-200",
  DOCUMENTS_REQUIRED: "bg-amber-50 text-amber-700 border border-amber-200",
  UNDER_REVIEW: "bg-purple-50 text-purple-700 border border-purple-200",
  VERIFICATION_IN_PROGRESS: "bg-blue-50 text-blue-700 border border-blue-200",
  COMPLETED: "bg-green-50 text-green-700 border border-green-200",
  REJECTED: "bg-red-50 text-red-700 border border-red-200",
  CANCELLED: "bg-muted text-muted-foreground",
};

function formatStatus(status: string) {
  return status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function formatAction(action: string) {
  return action.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AdminClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [notesError, setNotesError] = useState("");
  const [showStatusForm, setShowStatusForm] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [newNotes, setNewNotes] = useState("");

  async function load() {
    const res = await fetch(`/api/admin/clients/${id}`);
    if (res.ok) setDetail(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function updateStatus() {
    if (!newStatus) return;
    setSaving(true);
    setStatusError("");
    try {
      const res = await fetch(`/api/admin/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setStatusError(j.error || "Update failed");
        return;
      }
      await load();
      setShowStatusForm(false);
      setNewStatus("");
    } finally {
      setSaving(false);
    }
  }

  async function updateNotes() {
    setSaving(true);
    setNotesError("");
    try {
      const res = await fetch(`/api/admin/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: newNotes }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setNotesError(j.error || "Update failed");
        return;
      }
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-sm text-muted-gray">Loading client...</p></div>;
  }

  if (!detail) {
    return (
      <div className="py-20 text-center">
        <h2 className="font-heading text-xl font-semibold text-charcoal">Client not found</h2>
        <Link href="/admin/clients" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-charcoal underline-offset-2 hover:underline">
          ← Back to clients
        </Link>
      </div>
    );
  }

  const statusOpts = STATUS_OPTIONS.find((o) => o.value === detail.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/admin/clients" className="text-sm text-muted-foreground hover:underline">← All clients</Link>
        <div className="mt-2 flex items-start justify-between">
          <div>
            <h1 className="font-heading text-2xl font-semibold text-charcoal">{detail.name}</h1>
            <div className="mt-1 flex items-center gap-3 text-sm text-muted-gray">
              <span className="flex items-center gap-1"><Users className="size-3.5" />{detail.memberCount} member{detail.memberCount !== 1 ? "s" : ""}</span>
              <span className="flex items-center gap-1"><FileText className="size-3.5" />{detail.requestCount} request{detail.requestCount !== 1 ? "s" : ""}</span>
              <span className="flex items-center gap-1"><Clock className="size-3.5" />Joined {formatDate(detail.createdAt)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showStatusForm ? (
              <div className="flex items-center gap-2">
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Change status...</option>
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <Button size="sm" onClick={updateStatus} disabled={saving || !newStatus}>Save</Button>
                <Button variant="outline" size="sm" onClick={() => { setShowStatusForm(false); setNewStatus(""); setStatusError(""); }}>Cancel</Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => { setNewStatus(detail.status); setShowStatusForm(true); }}>
                <Edit className="size-3.5" /> Edit status
              </Button>
            )}
          </div>
        </div>
        {statusOpts && (
          <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusOpts.color}`}>
            <statusOpts.icon className="size-3.5" />{detail.status}
          </span>
        )}
        {statusError && <p className="mt-2 text-sm text-red-600">{statusError}</p>}
      </div>

      {detail.notes && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-sm text-muted-foreground">Internal Notes</h2>
            <Button variant="outline" size="sm" onClick={() => { setNewNotes(detail.notes || ""); setShowStatusForm(true); }}>
              <Edit className="size-3.5" /> Edit
            </Button>
          </div>
          {!showStatusForm && detail.notes && (
            <p className="mt-2 text-sm text-charcoal whitespace-pre-wrap">{detail.notes}</p>
          )}
          {showStatusForm && (
            <div className="mt-3 space-y-2">
              <Textarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Internal notes..."
                rows={3}
                className="min-h-[80px]"
              />
              {notesError && <p className="text-sm text-red-600">{notesError}</p>}
              <div className="flex gap-2">
                <Button size="sm" onClick={updateNotes} disabled={saving}>Save notes</Button>
                <Button variant="outline" size="sm" onClick={() => { setShowStatusForm(false); setNewNotes(""); setNotesError(""); }}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Members */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="flex items-center gap-2 font-medium"><Users className="size-4" />Team Members</h2>
            <span className="text-xs text-muted-foreground">{detail.members.length} members</span>
          </div>
          {detail.members.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No members yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {detail.members.map((m) => (
                <div key={m.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-charcoal">{m.name}</p>
                      <p className="text-xs text-muted-gray">{m.email}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      m.role === "OWNER" ? "bg-charcoal text-ivory" :
                      m.role === "MANAGER" ? "bg-purple-50 text-purple-700 border border-purple-200" :
                      m.role === "STAFF" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                      "bg-gray-50 text-gray-600"
                    }`}>
                      {m.role}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-gray">
                    <span className={`${m.status === "ACTIVE" ? "text-green-600" : "text-amber-600"}`}>
                      {m.status}
                    </span>
                    {m.lastLoginAt && <span>Last login: {formatDateTime(m.lastLoginAt)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent requests */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="flex items-center gap-2 font-medium"><FileText className="size-4" />Recent Requests</h2>
            <Link href={`/admin/requests?client=${detail.id}`} className="text-xs text-charcoal underline-offset-2 hover:underline">View all</Link>
          </div>
          {detail.requests.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No requests yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {detail.requests.map((r) => (
                <Link key={r.id} href={`/admin/requests/${r.id}`} className="block px-4 py-3 transition-colors hover:bg-cream/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-charcoal">{r.requestType || r.service}</p>
                      <p className="text-xs text-muted-gray">{r.service}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[r.status] || "bg-muted text-muted-foreground"}`}>
                      {formatStatus(r.status)}
                    </span>
                  </div>
                  {r.assignedStaff && (
                    <p className="mt-1 text-xs text-muted-gray">Assigned to {r.assignedStaff}</p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Documents */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="flex items-center gap-2 font-medium"><FolderOpen className="size-4" />Documents</h2>
            <span className="text-xs text-muted-foreground">{detail.documents.length} files</span>
          </div>
          {detail.documents.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No documents uploaded.</p>
          ) : (
            <div className="divide-y divide-border">
              {detail.documents.map((d) => (
                <div key={d.id} className="px-4 py-3">
                  <Link href={`/admin/requests/${d.requestId}`} className="block">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-charcoal truncate">{d.fileName}</p>
                        <p className="text-xs text-muted-gray">{d.requestTitle} · {formatDate(d.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          d.reviewStatus === "APPROVED" ? "bg-green-50 text-green-700" :
                          d.reviewStatus === "REJECTED" ? "bg-red-50 text-red-700" :
                          "bg-amber-50 text-amber-700"
                        }`}>
                          {d.reviewStatus}
                        </span>
                        {d.uploadStatus === "UPLOADED" && (
                          <a href={`/api/portal/documents/${d.id}`} target="_blank" rel="noopener" className="text-muted-gray hover:text-charcoal">
                            <Download className="size-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent messages */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="flex items-center gap-2 font-medium"><MessageSquare className="size-4" />Messages</h2>
            <span className="text-xs text-muted-foreground">{detail.messages.length} messages</span>
          </div>
          {detail.messages.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No messages yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {detail.messages.slice(0, 10).map((m) => (
                <div key={m.id} className={`px-4 py-3 ${m.isFromStaff ? "bg-primary/5" : ""}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-charcoal">
                      {m.authorName}
                      {m.isFromStaff && (
                        <span className="ml-1.5 rounded bg-charcoal px-1.5 py-0.5 text-[10px] font-medium text-ivory">
                          PK
                        </span>
                      )}
                      <span className="ml-1 text-xs text-muted-foreground">({m.authorRole})</span>
                    </span>
                    <span className="text-xs text-muted-gray">{formatDateTime(m.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-gray truncate">{m.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{m.requestTitle}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Activity */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="flex items-center gap-2 font-medium"><Activity className="size-4" />Activity Log</h2>
          <Link href="/admin/activity" className="text-xs text-charcoal underline-offset-2 hover:underline">View all activity</Link>
        </div>
        {detail.activity.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {detail.activity.map((a) => (
              <div key={a.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-charcoal">{formatAction(a.action)}</span>
                    <span className="text-sm text-muted-gray"> on {a.resource}</span>
                    {a.resourceId && (
                      <span className="text-xs text-muted-foreground">({a.resourceId.slice(0, 8)}...)</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-gray">{formatDateTime(a.createdAt)}</span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-gray">
                  {a.actorName && <span>By: {a.actorName}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
