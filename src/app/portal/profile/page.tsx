"use client";

import { useAuth } from "@/components/auth/AuthProvider";

function formatRole(role: string) {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

export default function PortalProfilePage() {
  const { user, client } = useAuth();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-charcoal">
          Account
        </h1>
        <p className="mt-2 text-muted-gray">
          Your account and business information.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* User info */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 font-heading text-lg font-semibold text-charcoal">
            Account Details
          </h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-gray">
                Name
              </dt>
              <dd className="mt-1 text-sm text-charcoal">{user?.name || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-gray">
                Email
              </dt>
              <dd className="mt-1 text-sm text-charcoal">{user?.email || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-gray">
                Role
              </dt>
              <dd className="mt-1 text-sm text-charcoal">
                {client ? formatRole(client.role) : user?.role || "—"}
              </dd>
            </div>
          </dl>
        </div>

        {/* Business info */}
        {client && (
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 font-heading text-lg font-semibold text-charcoal">
              Business Information
            </h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-gray">
                  Business Name
                </dt>
                <dd className="mt-1 text-sm text-charcoal">{client.name}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-gray">
                  Access Level
                </dt>
                <dd className="mt-1 text-sm text-charcoal">
                  {formatRole(client.role)}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
