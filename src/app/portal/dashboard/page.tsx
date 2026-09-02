"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  FolderOpen,
  MessageSquare,
  Briefcase,
  Clock,
  CheckCircle2,
  AlertCircle,
  Upload,
  Plus,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

type DashboardData = {
  activeServices: number;
  openRequests: number;
  pendingDocuments: number;
  unreadMessages: number;
  recentActivity: Array<{
    id: string;
    action: string;
    description: string;
    timestamp: string;
  }>;
  requests: Array<{
    id: string;
    title: string;
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

export default function PortalDashboardPage() {
  const { user, client } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch("/api/portal/dashboard");
        if (res.ok) {
          setData(await res.json());
        }
      } catch {
        // Dashboard data will be empty
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
      label: "Active Services",
      value: data?.activeServices ?? 0,
      icon: Briefcase,
      href: "/portal/services",
      color: "text-charcoal",
    },
    {
      label: "Open Requests",
      value: data?.openRequests ?? 0,
      icon: FileText,
      href: "/portal/requests",
      color: "text-blue-600",
    },
    {
      label: "Pending Documents",
      value: data?.pendingDocuments ?? 0,
      icon: FolderOpen,
      href: "/portal/documents",
      color: "text-amber-600",
    },
    {
      label: "Unread Messages",
      value: data?.unreadMessages ?? 0,
      icon: MessageSquare,
      href: "/portal/messages",
      color: "text-purple-600",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome section */}
      <div>
        <h1 className="font-heading text-3xl font-semibold text-charcoal">
          Welcome back, {user?.name || "there"}
        </h1>
        {client && (
          <p className="mt-1 text-muted-gray">
            {client.name} — Client Portal
          </p>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                <Icon className={`size-5 ${stat.color}`} />
              </div>
              <p className="mt-2 font-heading text-3xl font-semibold text-charcoal">
                {stat.value}
              </p>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Current work */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="font-heading text-lg font-semibold text-charcoal">
                Current Work
              </h2>
              <Link
                href="/portal/requests"
                className="text-sm font-medium text-charcoal underline-offset-2 hover:underline"
              >
                View All
              </Link>
            </div>
            <div className="divide-y divide-border">
              {data?.requests && data.requests.length > 0 ? (
                data.requests.map((req) => (
                  <Link
                    key={req.id}
                    href={`/portal/requests/${req.id}`}
                    className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-cream/50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-charcoal truncate">
                        {req.title || req.service}
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
                  <p className="mt-2 text-sm text-muted-gray">
                    No active requests
                  </p>
                  <Link
                    href="/portal/services"
                    className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-charcoal underline-offset-2 hover:underline"
                  >
                    <Plus className="size-3" />
                    Start a service request
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div>
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-6 py-4">
              <h2 className="font-heading text-lg font-semibold text-charcoal">
                Quick Actions
              </h2>
            </div>
            <div className="divide-y divide-border">
              <Link
                href="/portal/services"
                className="flex items-center gap-3 px-6 py-3.5 text-sm font-medium text-muted-gray transition-colors hover:bg-cream/50 hover:text-charcoal"
              >
                <Plus className="size-4" />
                Start a Service Request
              </Link>
              <Link
                href="/portal/documents"
                className="flex items-center gap-3 px-6 py-3.5 text-sm font-medium text-muted-gray transition-colors hover:bg-cream/50 hover:text-charcoal"
              >
                <Upload className="size-4" />
                Upload Documents
              </Link>
              <Link
                href="/portal/messages"
                className="flex items-center gap-3 px-6 py-3.5 text-sm font-medium text-muted-gray transition-colors hover:bg-cream/50 hover:text-charcoal"
              >
                <MessageSquare className="size-4" />
                Send a Message
              </Link>
              <Link
                href="/portal/services"
                className="flex items-center gap-3 px-6 py-3.5 text-sm font-medium text-muted-gray transition-colors hover:bg-cream/50 hover:text-charcoal"
              >
                <Briefcase className="size-4" />
                View Services
              </Link>
              <Link
                href="/portal/documents"
                className="flex items-center gap-3 px-6 py-3.5 text-sm font-medium text-muted-gray transition-colors hover:bg-cream/50 hover:text-charcoal"
              >
                <FolderOpen className="size-4" />
                View Documents
              </Link>
            </div>
          </div>

          {/* Recent activity */}
          {data?.recentActivity && data.recentActivity.length > 0 && (
            <div className="mt-6 rounded-lg border border-border bg-card">
              <div className="border-b border-border px-6 py-4">
                <h2 className="font-heading text-lg font-semibold text-charcoal">
                  Recent Activity
                </h2>
              </div>
              <div className="divide-y divide-border">
                {data.recentActivity.slice(0, 5).map((activity) => (
                  <div key={activity.id} className="px-6 py-3">
                    <p className="text-sm text-charcoal">{activity.description}</p>
                    <p className="mt-0.5 text-xs text-muted-gray">
                      {formatRelativeTime(activity.timestamp)}
                    </p>
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
