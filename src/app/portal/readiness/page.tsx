"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  currentClient,
  readinessFetch,
  human,
  date,
} from "@/components/readiness/client";
export default function ReadinessPortal() {
  const [rows, setRows] = useState<
    { id: string; status: string; paymentStatus: string; createdAt: string }[]
  >([]);
  const [message, setMessage] = useState("");
  useEffect(() => {
    void (async () => {
      try {
        const id = await currentClient();
        setRows(
          (await readinessFetch("/api/portal/readiness", id)).assessments,
        );
      } catch (error) {
        setMessage((error as Error).message);
      }
    })();
  }, []);
  return (
    <section className="space-y-5 p-5">
      <h1 className="text-3xl font-semibold">Your Readiness Assessments</h1>
      <p role="status">{message}</p>
      {rows.map((a) => (
        <Link
          className="block rounded border p-4"
          key={a.id}
          href={`/portal/readiness/${a.id}`}
        >
          {human(a.status)} · Payment {human(a.paymentStatus)} ·{" "}
          {date(a.createdAt)}
        </Link>
      ))}
      <Link className="underline" href="/readiness">
        About the $99 assessment
      </Link>
    </section>
  );
}
