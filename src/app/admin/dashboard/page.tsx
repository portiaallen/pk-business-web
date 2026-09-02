"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  FileText,
  FolderOpen,
  Briefcase,
  Clock,
  AlertCircle,
} from "lucide-react";

type AdminDashboard = {
  totalClients: number;
  activeClients: number;
  totalRequests: number;
  openRequests: number;
  pendingDocuments: number;
  recentRequests: Array<{
    id: string;
    clientName: string;
    service: string;
    status: string;
    updatedAt: string;
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

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch("/api/admin/dashboard");
        if (res.ok) {
          setData(await res.json());
        }
      } catch {
        // empty
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-gray">Loading dashboard...</p>
      </div>
    );
  }

  const stats = [
    {
      label: "Total Clients",
      value: data?.totalClients ?? 0,
      sublabel: `${data?.activeClients ?? 0} active`,
      icon: Users,
      href: "/admin/clients",
    },
    {
      label: "Total Requests",
      value: data?.totalRequests ?? 0,
      sublabel: `${data?.openRequests ?? 0} open`,
      icon: FileText,
      href: "/admin/requests",
    },
    {
      label: "Pending Documents",
      value: data?.pendingDocuments ?? 0,
      sublabel: "Awaiting review",
      icon: FolderOpen,
      href: "/admin/documents",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-charcoal">
          Admin Dashboard
        </h1>
        <p className="mt-2 text-muted-gray">
          Overview of PK Business Services operations.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="group rounded-lg border border-border bg-card p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-gray">
                  {stat.label}
                </span>
                <Icon className="size-5 text-charcoal" />
              </div>
              <p className="mt-2 font-heading text-3xl font-semibold text-charcoal">
                {stat.value}
              </p>
              <p className="mt-0.5 text-xs text-muted-gray">{stat.sublabel}</p>
            </Link>
          );
        })}
      </div>

      {/* Recent requests */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-heading text-lg font-semibold text-charcoal">
            Recent Requests
          </h2>
          <Link
            href="/admin/requests"
            className="text-sm font-medium text-charcoal underline-offset-2 hover:underline"
          >
            View All
          </Link>
        </div>
        <div className="divide-y divide-border">
          {data?.recentRequests && data.recentRequests.length > 0 ? (
            data.recentRequests.map((req) => (
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
                    {req.service} · Updated {formatRelativeTime(req.updatedAt)}
                  </p>
                </div>
                <span
                  className={`ml-4 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[req.status] || "bg-muted text-muted-foreground"}`}
                >
                  {formatStatus(req.status)}
                </span>
              </Link>
            ))
          ) : (
            <div className="px-6 py-10 text-center">
              <FileText className="mx-auto size-8 text-muted-gray/40" />
              <p className="mt-2 text-sm text-muted-gray">No requests yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
