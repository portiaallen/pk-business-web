"use client";
import { useEffect, useState } from "react";
import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import Link from "next/link";
import { SecurityAdministration } from "@/components/auth/SecurityAdministration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Credential = {
  id: string;
  label: string;
  deviceType: string;
  backedUp: boolean;
};
type Client = { id: string; name: string };
async function send(url: string, body: object) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Security request could not be completed");
  return data;
}
export default function SecurityPage() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [active, setActive] = useState("");
  const [password, setPassword] = useState("");
  const [label, setLabel] = useState("My passkey");
  const [codes, setCodes] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [canAdminister, setCanAdminister] = useState(false);
  const [userRole, setUserRole] = useState("CLIENT");
  const [signedIn, setSignedIn] = useState(false);
  async function load() {
    const res = await fetch("/api/auth/security", { cache: "no-store" });
    if (!res.ok) {
      setSignedIn(false);
      return;
    }
    const data = await res.json();
    const ctx = await fetch("/api/auth/client-context", { cache: "no-store" });
    if (ctx.ok) {
      const data = await ctx.json();
      setClients(data.clients);
      setActive(data.activeClientId || "");
    }
    setCredentials(data.credentials);
    setCanAdminister(data.canAdminister);
    setUserRole(data.role);
    setSignedIn(true);
  }
  useEffect(() => {
    fetch("/api/auth/security", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        const ctx = await fetch("/api/auth/client-context", {
          cache: "no-store",
        });
        if (ctx.ok) {
          const data = await ctx.json();
          setClients(data.clients);
          setActive(data.activeClientId || "");
        }
        setCredentials(data.credentials);
        setCanAdminister(data.canAdminister);
        setUserRole(data.role);
        setSignedIn(true);
      })
      .catch(() =>
        setMessage("Could not load account security. Please try again."),
      );
  }, []);
  async function act(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Please try again");
    } finally {
      setBusy(false);
      setPassword("");
    }
  }
  async function stepUp() {
    const challenge = await send("/api/auth/webauthn", {
      action: "step-up",
      password,
    });
    const response = await startAuthentication({
      optionsJSON: challenge.options,
    });
    await send("/api/auth/webauthn", {
      action: "verify",
      ticket: challenge.ticket,
      response,
    });
    setMessage(
      "Password and passkey verified. Sensitive actions are available for five minutes.",
    );
  }
  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-12">
      <h1 className="text-3xl font-semibold">Account security</h1>
      <p>
        Use your device’s passkey or an optional FIDO2 authenticator. A physical
        security key is not required.
      </p>
      <p role="status" aria-live="polite">
        {message}
      </p>
      {!signedIn ? (
        <Link href="/portal/login">Sign in to manage security</Link>
      ) : (
        <>
          <section className="space-y-3 rounded-xl border p-5">
            <h2 className="text-xl font-semibold">Active client</h2>
            <Label htmlFor="active-client">
              Choose the client you intend to work with
            </Label>
            <select
              id="active-client"
              value={active}
              className="min-h-12 w-full rounded border p-2"
              onChange={(e) => setActive(e.target.value)}
            >
              <option value="">Select a client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Button
              className="min-h-12"
              disabled={busy || !active}
              onClick={() =>
                act(async () => {
                  await send("/api/auth/client-context", { clientId: active });
                  setMessage("Client selected.");
                })
              }
            >
              Use this client
            </Button>
          </section>
          {!credentials.length && (
            <section className="space-y-3 rounded-xl border p-5">
              <h2 className="text-xl font-semibold">
                Password verification & sessions
              </h2>
              <Label htmlFor="client-security-password">Current password</Label>
              <Input
                className="min-h-12"
                id="client-security-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button
                className="min-h-12"
                disabled={busy || !password}
                onClick={() =>
                  act(async () => {
                    await send("/api/auth/security", {
                      action: "client-step-up",
                      password,
                    });
                    setMessage(
                      "Password verified. Membership changes are available for five minutes.",
                    );
                  })
                }
              >
                Verify password for membership changes
              </Button>
              <Button
                className="min-h-12"
                disabled={busy || !password}
                onClick={() =>
                  act(async () => {
                    await send("/api/auth/security", {
                      action: "revoke-all",
                      password,
                    });
                    setSignedIn(false);
                    setMessage("All sessions revoked.");
                  })
                }
              >
                Verify password and sign out every session
              </Button>
            </section>
          )}
          {!!credentials.length && (
            <>
              <section className="space-y-3 rounded-xl border p-5">
                <h2 className="text-xl font-semibold">
                  Verify for a sensitive action
                </h2>
                <Label htmlFor="security-password">Current password</Label>
                <Input
                  className="min-h-12"
                  id="security-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button
                  className="min-h-12"
                  disabled={busy || !password}
                  onClick={() => act(stepUp)}
                >
                  Verify password and passkey
                </Button>
              </section>
              <section className="space-y-3 rounded-xl border p-5">
                <h2 className="text-xl font-semibold">Your authenticators</h2>
                <ul className="space-y-3">
                  {credentials.map((c) => (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-3"
                    >
                      <span>
                        {c.label} · {c.deviceType}
                        {c.backedUp ? " · backed up by authenticator" : ""}
                      </span>
                      <Button
                        className="min-h-12"
                        disabled={busy || credentials.length < 2}
                        variant="outline"
                        onClick={() =>
                          act(async () => {
                            await send("/api/auth/security", {
                              action: "remove-credential",
                              credentialId: c.id,
                            });
                            setSignedIn(false);
                            setMessage("Authenticator removed. Sign in again.");
                          })
                        }
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
                <Label htmlFor="passkey-label">
                  Name for a new authenticator
                </Label>
                <Input
                  className="min-h-12"
                  id="passkey-label"
                  maxLength={80}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
                <Button
                  className="min-h-12"
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      const c = await send("/api/auth/webauthn", {
                        action: "enroll",
                      });
                      const response = await startRegistration({
                        optionsJSON: c.options,
                      });
                      await send("/api/auth/webauthn", {
                        action: "verify",
                        ticket: c.ticket,
                        response,
                        label,
                      });
                      await load();
                      setMessage("Authenticator added.");
                    })
                  }
                >
                  Add a passkey or authenticator
                </Button>
              </section>
              {canAdminister && <SecurityAdministration />}
              <section className="space-y-3 rounded-xl border p-5">
                <h2 className="text-xl font-semibold">Recovery and sessions</h2>
                <p>
                  New recovery codes replace all previous codes and sign you
                  out. Save them securely; they are shown once. Each code
                  permits MFA recovery, not normal privileged access.
                </p>
                <Button
                  className="min-h-12"
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      const result = await send("/api/auth/security", {
                        action: "recovery-codes",
                      });
                      setCodes(result.codes);
                      setSignedIn(false);
                      setMessage(
                        "Save your recovery codes before leaving. Sign in again afterward.",
                      );
                    })
                  }
                >
                  Generate new recovery codes
                </Button>
                <Button
                  className="min-h-12"
                  disabled={busy}
                  variant="outline"
                  onClick={() =>
                    act(async () => {
                      await send("/api/auth/security", {
                        action: "revoke-all",
                      });
                      setSignedIn(false);
                      setMessage("All sessions revoked.");
                    })
                  }
                >
                  Sign out every session
                </Button>
              </section>
            </>
          )}
        </>
      )}
      {!!codes.length && (
        <section className="rounded-xl border p-5">
          <h2 className="font-semibold">Save these codes securely</h2>
          <ul className="space-y-3 break-all font-mono text-sm">
            {codes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <Button className="min-h-12" onClick={() => setCodes([])}>
            I saved my codes — hide them
          </Button>
        </section>
      )}
      {signedIn && (
        <div className="flex flex-wrap gap-4">
          <Link
            href={
              userRole === "CLIENT" ? "/portal/dashboard" : "/admin/dashboard"
            }
          >
            Open workspace
          </Link>
        </div>
      )}
      <Link className="block underline" href="/portal/login">
        Return to sign in
      </Link>
    </div>
  );
}
