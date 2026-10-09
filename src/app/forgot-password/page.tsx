"use client";

import { Suspense, useState, useEffect, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Client-safe local constant — do not import from @/lib/password-reset here;
// that module pulls in server-only deps (nodemailer/prisma/crypto).
const MIN_PASSWORD_LENGTH = 12;

function ForgotPasswordInner() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  useEffect(() => {
    const consume = () => {
      const value = new URLSearchParams(window.location.hash.slice(1)).get("token") || searchParams.get("token") || "";
      // Consume into memory before removing it from visible history/later requests.
      if (value) {
        queueMicrotask(() => setToken(value));
        window.history.replaceState(null, "", "/forgot-password");
      }
    };
    consume();
    window.addEventListener("hashchange", consume);
    return () => window.removeEventListener("hashchange", consume);
  }, [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleRequest(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Request failed");
        return;
      }
      setMessage(data.message || "Request received.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Reset failed");
        return;
      }
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass = "h-11";
  const cardClass =
    "rounded-xl border border-border bg-background p-8 shadow-sm";

  if (token) {
    // ─── Reset mode ───
    if (done) {
      return (
        <div className="w-full max-w-md">
          <Header title="Password updated" />
          <div className={cardClass}>
            <p className="text-sm text-muted-gray">
              Your new password has been saved and all existing sessions have
              been signed out.
            </p>
            <Link
              href="/portal/login"
              className="mt-6 flex h-12 w-full items-center justify-center rounded-lg bg-charcoal text-sm font-medium text-ivory hover:bg-charcoal/90"
            >
              Sign in
            </Link>
          </div>
        </div>
      );
    }
    return (
      <div className="w-full max-w-md">
        <Header title="Choose a new password" />
        <div className={cardClass}>
          <form onSubmit={handleReset} className="space-y-5">
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
              >
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                className={inputClass}
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter your new password"
                className={inputClass}
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-12 w-full bg-charcoal text-ivory hover:bg-charcoal/90"
            >
              {isSubmitting ? "Saving..." : "Set new password"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // ─── Request mode ───
  return (
    <div className="w-full max-w-md">
      <Header title="Forgot admin password" />
      <div className={cardClass}>
        <form onSubmit={handleRequest} className="space-y-5">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            >
              {error}
            </div>
          )}
          {message && (
            <div
              role="status"
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400"
            >
              {message}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Admin email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@business.com"
              className={inputClass}
              autoComplete="email"
              required
            />
          </div>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-12 w-full bg-charcoal text-ivory hover:bg-charcoal/90"
          >
            {isSubmitting ? "Sending..." : "Send reset link"}
          </Button>
          <p className="text-center text-xs text-muted-gray">
            For security, a reset link is only sent when the email matches the
            PK admin account, and requests are limited to one every{" "}
            {10} minutes.
          </p>
        </form>
      </div>
    </div>
  );
}

function Header({ title }: { title: string }) {
  return (
    <div className="mb-8 text-center">
      <Link href="/" className="inline-block">
        <span className="font-heading text-2xl font-semibold text-charcoal">
          PK Business Services
        </span>
      </Link>
      <h1 className="mt-4 font-heading text-3xl font-semibold text-charcoal">
        {title}
      </h1>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-cream px-4">
      <Suspense fallback={null}>
        <ForgotPasswordInner />
      </Suspense>
    </div>
  );
}
