"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  currentClient,
  readinessFetch,
  human,
  date,
} from "@/components/readiness/client";
type Row = {
  id: string;
  status: string;
  paymentStatus: string;
  submittedAt: string | null;
  createdAt: string;
  slaDueAt: string | null;
  slaPausedAt: string | null;
  overdue: boolean;
  creditStatus: string | null;
  redeemDeadline: string | null;
  outsideCount: number;
};
export default function ReadinessQueue() {
  const [now] = useState(() => Date.now());
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [message, setMessage] = useState("");
  useEffect(() => {
    void (async () => {
      try {
        const context = await currentClient();
        setRows(
          (await readinessFetch("/api/admin/readiness", context)).assessments,
        );
      } catch (error) {
        setMessage((error as Error).message);
      }
    })();
  }, []);
  const filtered = rows.filter(
    (a) =>
      filter === "ALL" ||
      (filter === "INCOMPLETE" &&
        ["PAID", "INTAKE_IN_PROGRESS", "READY_TO_SUBMIT"].includes(a.status)) ||
      (filter === "OVERDUE" && a.overdue) ||
      (filter === "CREDIT_PENDING" &&
        a.creditStatus === "CLAIMED_PENDING_REVIEW") ||
      (filter === "CREDIT_EXPIRING" &&
        a.creditStatus === "APPROVED_AVAILABLE" &&
        !!a.redeemDeadline &&
        new Date(a.redeemDeadline).getTime() - now < 14 * 86400000) ||
      (filter === "OUTSIDE_USAGE" && a.outsideCount > 0) ||
      a.status === filter,
  );
  return (
    <section className="space-y-5 p-4 sm:p-6">
      <h1 className="text-3xl font-semibold">Readiness Command Center</h1>
      <p>
        Queue is limited to the selected client and explicitly granted
        engagements. Use Account security to change context or manage
        permissions.
      </p>
      <p role="status">{message}</p>
      <div className="flex flex-wrap gap-4">
        <Link className="underline" href="/admin/readiness/recommendations">
          Outside Recommendation Library
        </Link>
        <Link className="underline" href="/security">
          Security & client context
        </Link>
      </div>
      <p>
        {rows.length} assessment(s) · {rows.filter((a) => a.overdue).length}{" "}
        overdue ·{" "}
        {rows.filter((a) => a.creditStatus === "CLAIMED_PENDING_REVIEW").length}{" "}
        credit claim(s) pending
      </p>
      <label className="block max-w-md">
        Queue filter
        <select
          className="mt-2 min-h-12 w-full rounded border p-3"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          {[
            "ALL",
            "PAID",
            "INCOMPLETE",
            "SUBMITTED_FOR_REVIEW",
            "AWAITING_INFORMATION",
            "IN_REVIEW",
            "REPORT_DRAFT",
            "QA_REVIEW",
            "DELIVERED",
            "OVERDUE",
            "CREDIT_PENDING",
            "CREDIT_EXPIRING",
            "OUTSIDE_USAGE",
            "CLOSED",
            "CANCELLED",
            "REFUNDED",
          ].map((value) => (
            <option key={value} value={value}>
              {human(value)}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((a) => (
          <article key={a.id} className="space-y-2 rounded border p-4">
            <h2 className="font-semibold">
              <Link className="underline" href={`/admin/readiness/${a.id}`}>
                {a.id}
              </Link>
            </h2>
            <p>
              {human(a.status)} · Payment {human(a.paymentStatus)}
            </p>
            <p>
              Created {date(a.createdAt)} · Submitted {date(a.submittedAt)}
            </p>
            <p>
              Internal target {date(a.slaDueAt)}{" "}
              {a.slaPausedAt
                ? "(paused for information)"
                : a.overdue
                  ? "(overdue)"
                  : ""}
            </p>
            <p>
              Credit{" "}
              {a.creditStatus ? human(a.creditStatus) : "Not yet determined"}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
