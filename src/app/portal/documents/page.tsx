"use client";

import { useEffect, useState } from "react";
import { FolderOpen, Download, FileText } from "lucide-react";

type Document = {
  id: string;
  fileName: string;
  category: string;
  uploadStatus: string;
  reviewStatus: string;
  requestTitle: string;
  createdAt: string;
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PortalDocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDocuments() {
      try {
        const res = await fetch("/api/portal/documents");
        if (res.ok) {
          setDocuments(await res.json());
        }
      } catch {
        // empty
      } finally {
        setLoading(false);
      }
    }
    fetchDocuments();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-charcoal">
          Documents
        </h1>
        <p className="mt-2 text-muted-gray">
          View and manage documents associated with your service requests.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-gray">Loading documents...</p>
        </div>
      ) : documents.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center">
          <FolderOpen className="mx-auto size-10 text-muted-gray/40" />
          <h3 className="mt-3 font-heading text-lg font-semibold text-charcoal">
            No documents yet
          </h3>
          <p className="mt-1 text-sm text-muted-gray">
            Documents will appear here once they are uploaded to your requests.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-cream/50"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="size-5 shrink-0 text-muted-gray" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-charcoal truncate">
                    {doc.fileName}
                  </p>
                  <p className="text-xs text-muted-gray">
                    {doc.category} · {doc.requestTitle} · {formatDate(doc.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    doc.reviewStatus === "APPROVED"
                      ? "bg-green-50 text-green-700"
                      : doc.reviewStatus === "REJECTED"
                        ? "bg-red-50 text-red-700"
                        : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {doc.reviewStatus}
                </span>
                {doc.uploadStatus === "UPLOADED" && (
                  <Download className="size-4 shrink-0 text-muted-gray cursor-pointer hover:text-charcoal" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
