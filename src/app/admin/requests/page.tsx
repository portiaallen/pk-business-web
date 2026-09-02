"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
type Request = {
  id: string;
  clientName: string;
  service: string;
  status: string;
  assignedStaff: string | null;
  createdAt: string;
  updatedAt: string;
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

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRequests() {
      try {
        const res = await fetch("/api/admin/requests");
        if (res.ok) {
          setRequests(await res.json());
        }
      } catch {
        // empty
      } finally {
        setLoading(false);
      }
    }
    fetchRequests();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-charcoal">
          Service Requests
        </h1>
        <p className="mt-2 text-muted-gray">
          All service requests across all clients.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-gray">Loading requests...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center">
          <FileText className="mx-auto size-10 text-muted-gray/40" />
          <h3 className="mt-3 font-heading text-lg font-semibold text-charcoal">
            No requests yet
          </h3>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          {requests.map((req) => (
            <Link
              key={req.id}
              href={`/admin/requests/${req.id}`}
              className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-cream/50"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-charcoal">
                  {req.clientName}
                </p>
                <p className="mt-0.5 text-xs text-muted-gray">
                  {req.service} ·{" "}
                  {req.assignedStaff ? `Assigned to ${req.assignedStaff}` : "Unassigned"} · Created{" "}
                  {formatDate(req.createdAt)}
                </p>
              </div>
              <span
                className={`ml-4 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[req.status] || "bg-muted text-muted-foreground"}`}
              >
                {formatStatus(req.status)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
