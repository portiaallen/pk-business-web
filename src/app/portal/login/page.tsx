"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const adminMode = searchParams.get("admin") === "1";
  const requestedReturnTo = searchParams.get("returnTo");
  const safeReturnTo =
    requestedReturnTo?.startsWith("/") &&
    !requestedReturnTo.startsWith("//") &&
    !requestedReturnTo.includes("\\");
  const returnTo = safeReturnTo
    ? requestedReturnTo
    : adminMode
      ? "/admin/dashboard"
      : "/portal/dashboard";

  const [challenge, setChallenge] = useState<{ticket: string; options: Parameters<typeof startRegistration>[0]["optionsJSON"] | Parameters<typeof startAuthentication>[0]["optionsJSON"]; enrollment: boolean} | null>(null);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnTo, adminMode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      if (data.mfaRequired) { setChallenge(data); setPassword(""); return; }
      window.location.href = data.redirectUrl || returnTo;
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function verifyPasskey() {
    if (!challenge) return;
    setIsSubmitting(true); setError("");
    try {
      const response = challenge.enrollment
        ? await startRegistration({ optionsJSON: challenge.options as Parameters<typeof startRegistration>[0]["optionsJSON"] })
        : await startAuthentication({ optionsJSON: challenge.options as Parameters<typeof startAuthentication>[0]["optionsJSON"] });
      const res = await fetch("/api/auth/webauthn", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verify", ticket: challenge.ticket, response }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Passkey verification failed. Sign in again.");
      window.location.href = data.redirectUrl;
    } catch { setError("Passkey verification could not be completed. Start again if the challenge expired or was used."); }
    finally { setIsSubmitting(false); }
  }
  async function recover() {
    if (!challenge) return;
    setIsSubmitting(true); setError("");
    try {
      const res = await fetch("/api/auth/webauthn", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "recover", ticket: challenge.ticket, code: recoveryCode.trim() }) });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setChallenge(data); setRecoveryCode("");
    } catch { setError("Recovery could not be completed. Start sign-in again or contact your security administrator."); }
    finally { setIsSubmitting(false); }
  }
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center pk-login bg-cream px-4 py-14">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <span className="font-heading text-2xl font-semibold text-charcoal">
              PK Business Services
            </span>
          </Link>
          <h1 className="mt-4 pk-heading text-3xl font-semibold text-charcoal">
            {adminMode ? "PK Staff Sign In" : "Client Portal"}
          </h1>
          <p className="mt-2 text-sm text-muted-gray">
            {adminMode
              ? "Sign in with your PK staff account"
              : "Your records, requests, invoices, and completed work—all in one place."}
          </p>
        </div>

        {/* Login Form */}
        <div className="pk-login-card rounded-xl border border-border bg-background p-6 sm:p-8 shadow-sm">
          {challenge ? <div className="space-y-5">
            <h2 className="text-xl font-semibold">{challenge.enrollment ? "Register your passkey" : "Verify your passkey"}</h2>
            <p>Use your device’s supported platform passkey or an optional security key. No purchased hardware is required.</p>
            {error && <p role="alert">{error}</p>}
            <Button className="min-h-12 w-full" disabled={isSubmitting} onClick={verifyPasskey}>{challenge.enrollment ? "Create a passkey" : "Verify with a passkey"}</Button>
            {!challenge.enrollment && <><Label htmlFor="recovery-code">Lost access? Enter a single-use recovery code</Label><Input id="recovery-code" autoComplete="off" value={recoveryCode} onChange={e => setRecoveryCode(e.target.value)} /><Button disabled={isSubmitting || !recoveryCode} variant="outline" onClick={recover}>Recover and register a passkey</Button></>}
            <Button variant="outline" onClick={() => { setChallenge(null); setRecoveryCode(""); setError(""); }}>Start sign-in again</Button>
          </div> : <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
              >
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@business.com"
                className="h-11"
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="h-11"
                autoComplete="current-password"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-12 w-full bg-charcoal text-ivory hover:bg-charcoal/90"
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </Button>
          </form>}
        </div>

        {/* Help */}
        <p className="mt-6 text-center text-sm text-muted-gray">
          Forgot your password?{" "}
          <Link
            href="/forgot-password"
            className="font-medium text-charcoal underline-offset-2 hover:underline"
          >
            Reset it here
          </Link>
        </p>
        <p className="mt-2 text-center text-sm text-muted-gray">
          Need access?{" "}
          <Link
            href="/contact"
            className="font-medium text-charcoal underline-offset-2 hover:underline"
          >
            Request a consultation
          </Link>
        </p>
      </div>
    </div>
  );
}
