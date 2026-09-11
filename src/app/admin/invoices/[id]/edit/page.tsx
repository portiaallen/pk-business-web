"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { InvoiceForm } from "@/components/admin/InvoiceForm";

export default function EditInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const [status, setStatus] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/invoices/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setStatus(data?.invoice?.status ?? null);
        setChecked(true);
      })
      .catch(() => setChecked(true));
  }, [id]);

  if (!checked) return <p className="py-16 text-center text-sm text-muted-gray">Loading…</p>;
  if (status && status !== "DRAFT") {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-sm font-medium text-amber-900">
        Only draft invoices can be edited. This invoice is {status.toLowerCase().replace(/_/g, " ")}.
      </div>
    );
  }
  return <InvoiceForm mode="edit" invoiceId={id} />;
}
