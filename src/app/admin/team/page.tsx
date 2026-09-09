"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Shield,
  UserCircle,
  Building,
  Clock,
  AlertCircle,
  CheckCircle2,
  PauseCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  clientMemberships: Array<{
    id: string;
    clientId: string;
    clientName: string;
    role: string;
  }>;
  requestCount: number;
  sessionCount: number;
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-50 text-red-700 border border-red-200",
  STAFF: "bg-blue-50 text-blue-700 border border-blue-200",
  CLIENT: "bg-gray-50 text-gray-600 border border-gray-200",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-50 text-green-700",
  INACTIVE: "bg-muted text-muted-foreground",
  SUSPENDED: "bg-red-50 text-red-700",
  PENDING: "bg-amber-50 text-amber-700",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export default function AdminTeamPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        const params = new URLSearchParams();
        if (roleFilter) params.set("role", roleFilter);
        if (statusFilter) params.set("status", statusFilter);
        if (search) params.set("search", search);
        const res = await fetch(`/api/admin/team?${params}`);
        if (res.ok) setUsers(await res.json());
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [roleFilter, statusFilter, search]);

  const filtered = users.filter((u) => {
    const matchSearch = !search ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.name.toLowerCase().includes(search.toLowerCase());
    const matchRole = !roleFilter || u.role === roleFilter;
    const matchStatus = !statusFilter || u.status === statusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-charcoal">Team</h1>
        <p className="mt-2 text-muted-gray">
          Manage admin, staff, and client accounts.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-gray" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-10 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 min-w-[130px]"
        >
          <option value="">All roles</option>
          <option value="ADMIN">Admin</option>
          <option value="STAFF">Staff</option>
          <option value="CLIENT">Client</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 min-w-[130px]"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="PENDING">Pending</option>
        </select>
        <Button variant="outline" onClick={() => { setSearch(""); setRoleFilter(""); setStatusFilter(""); }} className="min-h-10">
          Clear filters
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-gray">Total users</span>
            <Users className="size-4 text-muted-gray" />
          </div>
          <p className="mt-2 font-heading text-2xl font-semibold text-charcoal">{users.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-gray">Admins</span>
            <Shield className="size-4 text-charcoal" />
          </div>
          <p className="mt-2 font-heading text-2xl font-semibold text-charcoal">
            {users.filter((u) => u.role === "ADMIN").length}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-gray">Active users</span>
            <CheckCircle2 className="size-4 text-green-600" />
          </div>
          <p className="mt-2 font-heading text-2xl font-semibold text-charcoal">
            {users.filter((u) => u.status === "ACTIVE").length}
          </p>
        </div>
      </div>

      {/* Users list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-gray">Loading users...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center">
          <Users className="mx-auto size-10 text-muted-gray/40" />
          <h3 className="mt-3 font-heading text-lg font-semibold text-charcoal">No users found</h3>
          <p className="mt-1 text-sm text-muted-gray">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-cream">
              <tr>
                <th className="px-4 py-3 font-semibold text-charcoal">User</th>
                <th className="px-4 py-3 font-semibold text-charcoal">Role</th>
                <th className="px-4 py-3 font-semibold text-charcoal">Status</th>
                <th className="px-4 py-3 font-semibold text-charcoal">Client memberships</th>
                <th className="px-4 py-3 font-semibold text-charcoal">Requests</th>
                <th className="px-4 py-3 font-semibold text-charcoal">Last login</th>
                <th className="px-4 py-3 font-semibold text-charcoal">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-cream/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {u.role === "ADMIN" ? (
                        <Shield className="size-4 text-red-500" />
                      ) : u.role === "STAFF" ? (
                        <UserCircle className="size-4 text-blue-500" />
                      ) : (
                        <Building className="size-4 text-gray-500" />
                      )}
                      <div>
                        <p className="font-medium text-charcoal">{u.name}</p>
                        <p className="text-xs text-muted-gray">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${ROLE_COLORS[u.role]}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[u.status]}`}>
                      {u.status === "ACTIVE" ? <CheckCircle2 className="size-3" /> :
                       u.status === "SUSPENDED" ? <AlertCircle className="size-3" /> :
                       u.status === "INACTIVE" ? <PauseCircle className="size-3" /> : null}
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.clientMemberships.length === 0 ? (
                      <span className="text-muted-foreground">None</span>
                    ) : (
                      <div className="space-y-1">
                        {u.clientMemberships.map((m) => (
                          <div key={m.id} className="flex items-center justify-between">
                            <Link href={`/admin/clients/${m.clientId}`} className="text-charcoal hover:text-gold text-sm block truncate max-w-[150px]">
                              {m.clientName}
                            </Link>
                            <span className="text-[10px] text-muted-foreground">{m.role}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-center">
                    {u.requestCount}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {u.lastLoginAt ? (
                      <span className="text-sm">{formatDateTime(u.lastLoginAt)}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Never</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(u.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
            Showing {filtered.length} of {users.length} users
          </div>
        </div>
      )}
    </div>
  );
}
