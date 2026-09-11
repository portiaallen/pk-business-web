"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { InvoiceForm } from "@/components/admin/InvoiceForm";

export default function NewInvoicePage() {
  const router = useRouter();
  const [canCreate, setCanCreate] = useState(true);
  useEffect(() => {
    // Guard: if the schema hasn't been pushed to production yet, fail soft.
    fetch("/api/admin/invoices")
      .then((r) => setCanCreate(r.ok))
      .catch(() => setCanCreate(false));
  }, []);
  if (!canCreate) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-6 text-sm font-medium text-red-900">
        The invoice system could not be loaded. If you are seeing this on production, the invoice
        database tables still need to be created (schema push required).
      </div>
    );
  }
  return <InvoiceForm mode="create" />;
}
