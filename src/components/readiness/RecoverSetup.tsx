"use client";
import Link from "next/link";
import { useState } from "react";
import { readinessFetch } from "./client";

export default function RecoverSetup({
  onRecovered,
}: {
  onRecovered: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function run(action: "REQUEST" | "VERIFY") {
    setBusy(true);
    setMessage("");
    try {
      await readinessFetch("/api/readiness/recovery", undefined, {
        action,
        fields: {
          email: email.trim(),
          ...(action === "VERIFY" ? { code: code.trim() } : {}),
        },
      });
      setCode("");
      if (action === "REQUEST") {
        setRequested(true);
        setMessage(
          "If a paid assessment is awaiting setup, use the most recent recovery code sent to this email. Check your spam folder if needed.",
        );
      } else {
        setRequested(false);
        setMessage(
          "Setup access restored for 15 minutes. Continue account setup above. You do not need to pay again.",
        );
        await onRecovered();
      }
    } catch (error) {
      setCode("");
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4 rounded border p-5">
      <h2 className="text-xl font-semibold">
        Already paid but lost your setup session?
      </h2>
      <p>
        Recover access using the email from your original purchase. Your
        assessment and payment stay saved. Recovery codes expire after 10
        minutes and work once.
      </p>
      <p>
        Already created your account?{" "}
        <Link className="underline" href="/portal/login">
          Sign in to the client portal.
        </Link>
      </p>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void run("REQUEST");
        }}
      >
        <label className="block">
          Purchase email
          <input
            className="mt-1 block min-h-12 w-full rounded border p-3"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setRequested(false);
              setCode("");
            }}
          />
        </label>
        <button className="rounded border px-4 py-3" disabled={busy}>
          Send recovery code
        </button>
      </form>
      {requested && (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void run("VERIFY");
          }}
        >
          <label className="block">
            Recovery code
            <input
              className="mt-1 block min-h-12 w-full rounded border p-3"
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              minLength={32}
              maxLength={32}
              pattern="[a-f0-9]{32}"
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </label>
          <button
            className="rounded bg-pink-700 px-4 py-3 text-white"
            disabled={busy}
          >
            Restore setup access
          </button>
        </form>
      )}
      <p role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
