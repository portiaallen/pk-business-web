"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Users, Search, Plus, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Client = {
  id: string;
  name: string;
  status: string;
  memberCount: number;
  requestCount: number;
  createdAt: string;
};

type CreatedClient = {
  id: string;
  name: string;
  email: string;
  ownerName: string;
  oneTimePassword: string;
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

  // Add-client form state
  const [showForm, setShowForm] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedClient | null>(null);
  const [copied, setCopied] = useState(false);

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

  useEffect(() => {
    fetchClients();
  }, []);

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.id.toLowerCase().includes(search.toLowerCase())
  );

  async function handleCreateClient(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    setCreated(null);
    try {
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName,
          email,
          ownerName,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Failed to create client");
        return;
      }
      setCreated(data);
      setBusinessName("");
      setEmail("");
      setOwnerName("");
      setNotes("");
      setShowForm(false);
      setLoading(true);
      await fetchClients();
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyPassword() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.oneTimePassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — user can select manually
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-charcoal">
            Clients
          </h1>
          <p className="mt-2 text-muted-gray">
            Manage B2B client accounts and memberships.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-10"
          onClick={() => {
            setShowForm(!showForm);
            setCreated(null);
            setFormError("");
          }}
        >
          <Plus className="size-4" />
          {showForm ? "Close" : "Add client"}
        </Button>
      </div>

      {/* Add client form */}
      {showForm && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-heading text-lg font-semibold text-charcoal">
            New B2B client
          </h2>
          <p className="mt-1 text-sm text-muted-gray">
            Creates the business tenant, the owner&apos;s login, and an OWNER
            membership in one step. A one-time password is generated — share it
            with the owner securely.
          </p>
          <form
            onSubmit={handleCreateClient}
            className="mt-5 grid gap-4 sm:grid-cols-2"
          >
            <div className="space-y-2">
              <Label htmlFor="businessName">Business name *</Label>
              <Input
                id="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Lucia&apos;s Cleaning Co."
                className="h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ownerEmail">Owner email *</Label>
              <Input
                id="ownerEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@business.com"
                className="h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ownerName">Owner name</Label>
              <Input
                id="ownerName"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Optional"
                className="h-11"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="clientNotes">Notes</Label>
              <Textarea
                id="clientNotes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional internal note about this client"
                rows={2}
              />
            </div>
            {formError && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive sm:col-span-2"
              >
                {formError}
              </p>
            )}
            <div className="sm:col-span-2">
              <Button
                type="submit"
                disabled={submitting}
                className="h-11 bg-charcoal text-ivory hover:bg-charcoal/90"
              >
                {submitting ? "Creating..." : "Create client account"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* One-time password (after creation) */}
      {created && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="font-heading text-lg font-semibold text-charcoal">
            Client created — one-time password
          </h2>
          <p className="mt-1 text-sm text-amber-900">
            <strong>{created.name}</strong> · {created.email} · owner:{" "}
            {created.ownerName}. This password is shown once and can never be
            retrieved again — send it to the owner over a secure channel, then
            have them change it after first login.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <code className="rounded-lg border border-amber-300 bg-white px-4 py-2 font-mono text-sm text-charcoal">
              {created.oneTimePassword}
            </code>
            <Button
              type="button"
              variant="outline"
              className="min-h-10"
              onClick={copyPassword}
            >
              {copied ? (
                <Check className="size-4 text-green-600" />
              ) : (
                <Copy className="size-4" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      )}

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
          {!search && (
            <p className="mt-1 text-sm text-muted-gray">
              Use “Add client” to onboard your first B2B business.
            </p>
          )}
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