"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";

type AuditEntry = {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  actorName: string | null;
  clientName: string | null;
  metadata: string;
  createdAt: string;
};

function formatAction(action: string) {
  return action
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

export default function AdminActivityPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchActivity() {
      try {
        const res = await fetch("/api/admin/activity");
        if (res.ok) {
          setEntries(await res.json());
        }
      } catch {
        // empty
      } finally {
        setLoading(false);
      }
    }
    fetchActivity();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-charcoal">
          Activity Log
        </h1>
        <p className="mt-2 text-muted-gray">
          Audit trail of all platform activity.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-gray">Loading activity...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center">
          <Activity className="mx-auto size-10 text-muted-gray/40" />
          <h3 className="mt-3 font-heading text-lg font-semibold text-charcoal">
            No activity yet
          </h3>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          {entries.map((entry) => (
            <div key={entry.id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-charcoal">
                    {formatAction(entry.action)}
                  </span>
                  <span className="text-sm text-muted-gray">
                    {" "}on {entry.resource}
                    {entry.resourceId && ` (${entry.resourceId.slice(0, 8)}...)`}
                  </span>
                </div>
                <span className="text-xs text-muted-gray">
                  {formatTime(entry.createdAt)}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-gray">
                {entry.actorName && <span>By: {entry.actorName}</span>}
                {entry.clientName && <span>Client: {entry.clientName}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
