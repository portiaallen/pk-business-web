"use client";

import { useCallback, useEffect, useState } from "react";

interface Redemption {
  id: string;
  redemptionCode: string;
  fullName: string;
  email: string;
  phone: string | null;
  status: string;
  reviewedByStaffId: string | null;
  reviewNotes: string | null;
  auditTrail: Array<Record<string, unknown>>;
  createdAt: string;
  updatedAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING_REVIEW: "bg-amber-100 text-amber-900",
  APPROVED: "bg-green-100 text-green-900",
  REJECTED: "bg-red-100 text-red-900",
  REDEEMED: "bg-emerald-100 text-emerald-900",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: "Pending review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  REDEEMED: "Redeemed",
};

export function GrouponQueue() {
  const [items, setItems] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/groupon");
      if (!res.ok) {
        setError(res.status === 403 ? "Staff access required." : "Could not load the queue.");
        setItems([]);
        return;
      }
      setItems((await res.json()) as Redemption[]);
    } catch {
      setError("Could not load the queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, action: string, notes: string) {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/groupon", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, notes }),
      });
      if (!res.ok) {
        setError("The update did not go through. Try again.");
        return;
      }
      await load();
    } catch {
      setError("The update did not go through. Try again.");
    } finally {
      setBusyId("");
    }
  }

  if (loading) return <p className="text-sm text-muted-gray">Loading queue...</p>;

  return (
    <div className="space-y-4">
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}
      {items.length === 0 ? (
        <p className="text-sm text-muted-gray">No voucher claims yet.</p>
      ) : null}
      {items.map((item) => (
        <div key={item.id} className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-mono text-sm font-semibold text-charcoal">{item.redemptionCode}</p>
              <p className="text-sm text-muted-gray">
                {item.fullName} · {item.email}
                {item.phone ? ` · ${item.phone}` : ""}
              </p>
              <p className="text-xs text-muted-gray">
                Claimed {new Date(item.createdAt).toLocaleString()}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[item.status] ?? ""}`}>
              {STATUS_LABELS[item.status] ?? item.status}
            </span>
          </div>
          {item.reviewNotes ? (
            <p className="mt-2 text-xs text-muted-gray">Notes: {item.reviewNotes}</p>
          ) : null}
          {item.status === "PENDING_REVIEW" || item.status === "REJECTED" ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busyId === item.id}
                onClick={() => act(item.id, "APPROVE", "")}
                className="rounded-lg bg-green-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={busyId === item.id}
                onClick={() => act(item.id, "REJECT", "Voucher could not be verified in Merchant Center")}
                className="rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          ) : null}
          {item.status === "APPROVED" ? (
            <button
              type="button"
              disabled={busyId === item.id}
              onClick={() => act(item.id, "MARK_REDEEMED", "")}
              className="mt-3 rounded-lg bg-charcoal px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              Mark assessment started / redeemed
            </button>
          ) : null}
          {item.auditTrail.length > 0 ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-muted-gray">Audit trail ({item.auditTrail.length})</summary>
              <ul className="mt-1 space-y-1 text-xs text-muted-gray">
                {item.auditTrail.map((entry, index) => (
                  <li key={index}>
                    {String(entry.at ?? "")} · {String(entry.action ?? "")}
                    {entry.notes ? ` · ${String(entry.notes)}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ))}
    </div>
  );
}
