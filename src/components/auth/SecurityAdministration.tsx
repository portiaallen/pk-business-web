"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
const capabilities = [
  "confidential_access",
  "bookkeeping",
  "tax_preparation",
  "qa",
  "filing",
  "pricing",
  "payments",
  "client_management",
  "consultations",
  "assignments",
  "permissions",
  "audit",
  "security",
  "legal_hold",
  "disposal",
  "bulk_export",
];
export function SecurityAdministration() {
  const [targetId, setTargetId] = useState("");
  const [target, setTarget] = useState<{
    securityVersion: number;
    name: string;
    role: string;
    status: string;
  } | null>(null);
  const [action, setAction] = useState("grant");
  const [capability, setCapability] = useState("confidential_access");
  const [scope, setScope] = useState("REQUEST");
  const [clientId, setClientId] = useState("");
  const [requestId, setRequestId] = useState("");
  const [role, setRole] = useState("STAFF");
  const [proof, setProof] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    const response = await fetch(
      `/api/admin/security?userId=${encodeURIComponent(targetId)}`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      setTarget(null);
      throw new Error(
        "Authorized security access and a valid user ID are required.",
      );
    }
    setTarget(await response.json());
  }
  async function run(change: boolean) {
    setBusy(true);
    setMessage("");
    try {
      if (!change) {
        await load();
        return;
      }
      if (!target) return;
      const reason =
        action === "offboard"
          ? "STAFF_OFFBOARDING"
          : action === "manual-recovery"
            ? "VERIFIED_MANUAL_RECOVERY"
            : action === "enrollment"
              ? "AUTHORIZED_ENROLLMENT"
              : "APPROVED_ACCESS_CHANGE";
      const response = await fetch("/api/admin/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          targetId,
          expectedVersion: target.securityVersion,
          capability,
          scope,
          clientId,
          requestId,
          role,
          reason,
          identityProofApproved: proof,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Security change failed");
      await load();
      setMessage("Security change audited. Affected sessions were revoked.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Security request failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3 rounded-xl border p-5">
      <h2 className="text-xl font-semibold">Security administration</h2>
      <p>
        Requires explicitly granted authority and recent password/passkey
        verification. You cannot grant yourself access.
      </p>
      <Label htmlFor="security-target">Target user ID</Label>
      <Input
        className="min-h-12"
        id="security-target"
        value={targetId}
        onChange={(e) => {
          setTargetId(e.target.value);
          setTarget(null);
        }}
      />
      <Button
        className="min-h-12"
        disabled={busy || !targetId}
        variant="outline"
        onClick={() => run(false)}
      >
        Load user security state
      </Button>
      {target && (
        <>
          <p>
            {target.name} · {target.role} · {target.status}
          </p>
          <Label htmlFor="security-action">Action</Label>
          <select
            id="security-action"
            className="min-h-12 w-full rounded border p-2"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          >
            {[
              "grant",
              "revoke",
              "role",
              "enrollment",
              "offboard",
              "manual-recovery",
            ].map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          {["grant", "revoke"].includes(action) && (
            <>
              <Label htmlFor="security-capability">Capability</Label>
              <select
                id="security-capability"
                className="min-h-12 w-full rounded border p-2"
                value={capability}
                onChange={(e) => setCapability(e.target.value)}
              >
                {capabilities.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <Label htmlFor="security-scope">Scope</Label>
              <select
                id="security-scope"
                className="min-h-12 w-full rounded border p-2"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
              >
                <option>REQUEST</option>
                <option>CLIENT</option>
                <option>GLOBAL</option>
              </select>
              {scope !== "GLOBAL" && (
                <>
                  <Label htmlFor="security-client">Client ID</Label>
                  <Input
                    className="min-h-12"
                    id="security-client"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                  />
                </>
              )}
              {scope === "REQUEST" && (
                <>
                  <Label htmlFor="security-request">Engagement ID</Label>
                  <Input
                    className="min-h-12"
                    id="security-request"
                    value={requestId}
                    onChange={(e) => setRequestId(e.target.value)}
                  />
                </>
              )}
            </>
          )}
          {action === "role" && (
            <>
              <Label htmlFor="security-role">
                Global role (does not grant specialized capabilities)
              </Label>
              <select
                id="security-role"
                className="min-h-12 w-full rounded border p-2"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option>STAFF</option>
                <option>ADMIN</option>
              </select>
            </>
          )}
          {action === "manual-recovery" && (
            <Label className="flex gap-3">
              <input
                type="checkbox"
                checked={proof}
                onChange={(e) => setProof(e.target.checked)}
              />
              I completed PK’s approved manual identity-proof procedure. This
              invalidates existing authenticators and permits enrollment for 15
              minutes.
            </Label>
          )}
          {action === "offboard" && (
            <p>
              This disables the account and removes sessions, assignments,
              capabilities and recovery/authenticator access.
            </p>
          )}
          <Button
            className="min-h-12"
            disabled={busy || (action === "manual-recovery" && !proof)}
            onClick={() => run(true)}
          >
            Apply audited security change
          </Button>
        </>
      )}
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
