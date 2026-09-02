"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

type Member = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLoginAt: string | null;
};

const ROLE_RANK: Record<string, number> = { VIEWER: 1, STAFF: 2, MANAGER: 3, OWNER: 4 };
const ROLES = ["VIEWER", "STAFF", "MANAGER", "OWNER"];

export default function TeamPage() {
  const { memberRole } = useAuth() as { memberRole?: string };
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "VIEWER" });

  const canManage = memberRole === "MANAGER" || memberRole === "OWNER";
  const isOwner = memberRole === "OWNER";

  const load = useCallback(async () => {
    const res = await fetch("/api/portal/members");
    if (res.ok) setMembers(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function invite() {
    setError("");
    const res = await fetch("/api/portal/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowInvite(false);
      setForm({ name: "", email: "", password: "", role: "VIEWER" });
      await load();
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Invite failed");
    }
  }

  async function changeRole(memberId: string, role: string) {
    setError("");
    const res = await fetch("/api/portal/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, role }),
    });
    if (res.ok) await load();
    else {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Role change failed");
    }
  }

  async function remove(memberId: string) {
    setError("");
    const res = await fetch(`/api/portal/members?memberId=${encodeURIComponent(memberId)}`, {
      method: "DELETE",
    });
    if (res.ok) await load();
    else {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Removal failed");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Team</h1>
          <p className="text-sm text-muted-foreground">People with access to this business workspace.</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowInvite(!showInvite)}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Invite member
          </button>
        )}
      </div>

      {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {showInvite && canManage && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <h2 className="font-medium">Invite a team member</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <input className="rounded-md border bg-background px-3 py-2 text-sm" placeholder="Full name"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="rounded-md border bg-background px-3 py-2 text-sm" placeholder="Email" type="email"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="rounded-md border bg-background px-3 py-2 text-sm" placeholder="Temporary password (10+ chars)"
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <select className="rounded-md border bg-background px-3 py-2 text-sm"
              value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.filter((r) => isOwner || (r !== "OWNER" && r !== "MANAGER")).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <button onClick={invite} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
            Send invite
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="divide-y rounded-lg border bg-card">
          {members.map((m) => (
            <div key={m.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">{m.name}</p>
                <p className="text-xs text-muted-foreground">{m.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {canManage && m.userId !== undefined && ROLE_RANK[m.role] <= ROLE_RANK[memberRole || ""] ? (
                  <select
                    className="rounded-md border bg-background px-2 py-1 text-xs"
                    value={m.role}
                    onChange={(e) => changeRole(m.id, e.target.value)}
                    disabled={!isOwner && ROLE_RANK[m.role] >= 3}
                  >
                    {ROLES.filter((r) => isOwner || (r !== "OWNER" && r !== "MANAGER")).map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                ) : (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs">{m.role}</span>
                )}
                {canManage && (
                  <button
                    onClick={() => remove(m.id)}
                    className="text-xs text-red-600 hover:underline"
                    disabled={!isOwner && m.role === "OWNER"}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
