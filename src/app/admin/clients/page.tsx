"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Search } from "lucide-react";

type Client = {
  id: string;
  name: string;
  status: string;
  memberCount: number;
  requestCount: number;
  createdAt: string;
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AdminClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchClients() {
      try {
        const res = await fetch("/api/admin/clients");
        if (res.ok) {
          setClients(await res.json());
        }
      } catch {
        // empty
      } finally {
        setLoading(false);
      }
    }
    fetchClients();
  }, []);

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-charcoal">
          Clients
        </h1>
        <p className="mt-2 text-muted-gray">
          Manage B2B client accounts and memberships.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-gray" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clients..."
          className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-gray">Loading clients...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center">
          <Users className="mx-auto size-10 text-muted-gray/40" />
          <h3 className="mt-3 font-heading text-lg font-semibold text-charcoal">
            {search ? "No clients match your search" : "No clients yet"}
          </h3>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          {filtered.map((client) => (
            <Link
              key={client.id}
              href={`/admin/clients/${client.id}`}
              className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-cream/50"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-charcoal">{client.name}</p>
                <p className="mt-0.5 text-xs text-muted-gray">
                  {client.memberCount} member{client.memberCount !== 1 ? "s" : ""} ·{" "}
                  {client.requestCount} request{client.requestCount !== 1 ? "s" : ""} · Created{" "}
                  {formatDate(client.createdAt)}
                </p>
              </div>
              <span
                className={`ml-4 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  client.status === "ACTIVE"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {client.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
