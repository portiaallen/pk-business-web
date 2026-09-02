"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  FolderOpen,
  MessageSquare,
  Download,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type RequestDetail = {
  id: string;
  service: string;
  status: string;
  requestType: string;
  clientNotes: string | null;
  assignedStaff: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  documents: Array<{
    id: string;
    fileName: string;
    category: string;
    uploadStatus: string;
    reviewStatus: string;
    createdAt: string;
  }>;
  documentRequests: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    required: boolean;
  }>;
  messages: Array<{
    id: string;
    body: string;
    isFromStaff: boolean;
    authorName: string;
    createdAt: string;
  }>;
  deliverables: Array<{
    id: string;
    title: string;
    fileName: string;
    createdAt: string;
  }>;
};

const statusColors: Record<string, string> = {
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
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function RequestDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [req, setReq] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    async function fetchRequest() {
      try {
        const res = await fetch(`/api/portal/requests/${id}`);
        if (res.ok) {
          setReq(await res.json());
        }
      } catch {
        // empty
      } finally {
        setLoading(false);
      }
    }
    fetchRequest();
  }, [id]);

  async function sendMessage() {
    if (!messageText.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/portal/requests/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: messageText.trim() }),
      });
      if (res.ok) {
        setMessageText("");
        // Refresh request data
        const refresh = await fetch(`/api/portal/requests/${id}`);
        if (refresh.ok) {
          setReq(await refresh.json());
        }
      }
    } catch {
      // empty
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-gray">Loading request...</p>
      </div>
    );
  }

  if (!req) {
    return (
      <div className="py-20 text-center">
        <h2 className="font-heading text-xl font-semibold text-charcoal">
          Request not found
        </h2>
        <Link
          href="/portal/requests"
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-charcoal underline-offset-2 hover:underline"
        >
          <ArrowLeft className="size-3" />
          Back to requests
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link
          href="/portal/requests"
          className="inline-flex items-center gap-1 text-sm text-muted-gray hover:text-charcoal"
        >
          <ArrowLeft className="size-3" />
          Back to requests
        </Link>
        <div className="mt-4 flex items-start justify-between">
          <div>
            <h1 className="font-heading text-2xl font-semibold text-charcoal">
              {req.requestType}
            </h1>
            <p className="mt-1 text-sm text-muted-gray">
              {req.service} · Created {formatTime(req.createdAt)}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${statusColors[req.status] || "bg-muted text-muted-foreground"}`}
          >
            {formatStatus(req.status)}
          </span>
        </div>
        {req.assignedStaff && (
          <p className="mt-2 text-sm text-muted-gray">
            Assigned to: <span className="font-medium text-charcoal">{req.assignedStaff}</span>
          </p>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-8 lg:col-span-2">
          {/* Notes */}
          {req.clientNotes && (
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="mb-3 font-heading text-lg font-semibold text-charcoal">
                Your Notes
              </h2>
              <p className="text-sm leading-relaxed text-muted-gray whitespace-pre-wrap">
                {req.clientNotes}
              </p>
            </div>
          )}

          {/* Messages */}
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-6 py-4">
              <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-charcoal">
                <MessageSquare className="size-4" />
                Messages
              </h2>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-border">
              {req.messages.length === 0 ? (
                <div className="px-6 py-8 text-center text-sm text-muted-gray">
                  No messages yet
                </div>
              ) : (
                req.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`px-6 py-4 ${msg.isFromStaff ? "bg-cream/50" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-charcoal">
                        {msg.authorName}
                        {msg.isFromStaff && (
                          <span className="ml-1.5 rounded bg-charcoal px-1.5 py-0.5 text-[10px] font-medium text-ivory">
                            PK Staff
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-muted-gray">
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted-gray whitespace-pre-wrap">
                      {msg.body}
                    </p>
                  </div>
                ))
              )}
            </div>
            {/* Send message */}
            <div className="border-t border-border p-4">
              <Textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type your message..."
                rows={3}
                className="min-h-[80px] resize-y"
              />
              <div className="mt-2 flex justify-end">
                <Button
                  onClick={sendMessage}
                  disabled={!messageText.trim() || sending}
                  className="bg-charcoal text-ivory hover:bg-charcoal/90"
                >
                  <Send className="mr-2 size-3.5" />
                  {sending ? "Sending..." : "Send Message"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Documents */}
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-6 py-4">
              <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-charcoal">
                <FolderOpen className="size-4" />
                Documents
              </h2>
            </div>
            <div className="divide-y divide-border">
              {req.documents.length === 0 ? (
                <div className="px-6 py-6 text-center text-sm text-muted-gray">
                  No documents uploaded
                </div>
              ) : (
                req.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between px-6 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-charcoal truncate">
                        {doc.fileName}
                      </p>
                      <p className="text-xs text-muted-gray">{doc.category}</p>
                    </div>
                    {doc.uploadStatus === "UPLOADED" && (
                      <Download className="size-4 shrink-0 text-muted-gray" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Required documents */}
          {req.documentRequests.length > 0 && (
            <div className="rounded-lg border border-border bg-card">
              <div className="border-b border-border px-6 py-4">
                <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-charcoal">
                  <AlertCircle className="size-4 text-amber-600" />
                  Required From You
                </h2>
              </div>
              <div className="divide-y divide-border">
                {req.documentRequests.map((dr) => (
                  <div key={dr.id} className="px-6 py-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-charcoal">
                        {dr.title}
                        {dr.required && (
                          <span className="ml-1 text-destructive">*</span>
                        )}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          dr.status === "COMPLETED"
                            ? "bg-green-50 text-green-700"
                            : dr.status === "UPLOADED" || dr.status === "UNDER_REVIEW"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {formatStatus(dr.status)}
                      </span>
                    </div>
                    {dr.description && (
                      <p className="mt-1 text-xs text-muted-gray">{dr.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deliverables */}
          {req.deliverables.length > 0 && (
            <div className="rounded-lg border border-border bg-card">
              <div className="border-b border-border px-6 py-4">
                <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-charcoal">
                  <CheckCircle2 className="size-4 text-green-600" />
                  Deliverables
                </h2>
              </div>
              <div className="divide-y divide-border">
                {req.deliverables.map((del) => (
                  <div key={del.id} className="flex items-center justify-between px-6 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-charcoal">{del.title}</p>
                      <p className="text-xs text-muted-gray">{del.fileName}</p>
                    </div>
                    <Download className="size-4 shrink-0 text-muted-gray" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
