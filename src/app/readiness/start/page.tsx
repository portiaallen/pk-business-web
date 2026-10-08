"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { readinessFetch } from "@/components/readiness/client";
import RecoverSetup from "@/components/readiness/RecoverSetup";
export default function ReadinessStart() {
  const router = useRouter();
  const [status, setStatus] = useState<{
    paymentStatus?: string;
    status?: string;
    clientId?: string;
    assessmentId?: string;
    accountReady?: boolean;
    checkoutAvailable?: boolean;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  async function refresh() {
    try {
      setStatus(await readinessFetch("/api/readiness/status"));
      setMessage("");
    } catch (error) {
      setStatus({});
      setMessage((error as Error).message);
    }
  }
  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, []);
  async function action(run: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await run();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function finish(fields: object) {
    const result = await readinessFetch("/api/readiness/onboard", undefined, {
      action: "COMPLETE",
      fields,
    });
    await readinessFetch("/api/auth/client-context", undefined, {
      clientId: result.clientId,
    });
    router.push(`/portal/readiness/${result.assessmentId}`);
  }
  return (
    <section className="mx-auto max-w-xl space-y-6 px-5 py-12">
      <p className="text-sm font-semibold text-pink-700">
        PK Books, Business & Tax Season Readiness Assessment
      </p>
      <h1 className="text-3xl font-semibold">Your assessment starts here.</h1>
      <p>
        $99 USD, one time. A checkout redirect does not confirm payment. PK
        verifies payment securely before account setup and intake.
      </p>
      <p role="status" aria-live="polite">
        {message}
      </p>
      {!status ? (
        <p>Checking your purchase…</p>
      ) : status.paymentStatus !== "PAID" ? (
        <div className="space-y-4">
          <p>
            {status.assessmentId
              ? "Your assessment is saved. Payment is waiting for secure confirmation."
              : "Start from the readiness page to enter your preliminary details."}
          </p>
          <button
            className="rounded border px-4 py-3"
            disabled={busy}
            onClick={() => void refresh()}
          >
            Check payment status
          </button>
          {status.assessmentId && status.checkoutAvailable && (
            <button
              className="rounded bg-pink-700 px-4 py-3 text-white"
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  const result = await readinessFetch(
                    "/api/readiness/checkout",
                    undefined,
                    {},
                  );
                  window.location.assign(result.url);
                })
              }
            >
              Continue secure $99 checkout
            </button>
          )}
          <Link className="block underline" href="/readiness">
            Return to readiness page
          </Link>
        </div>
      ) : status.accountReady ? (
        <div>
          <p>Your payment is confirmed and your account is ready.</p>
          <Link
            className="underline"
            href={`/portal/readiness/${status.assessmentId}`}
          >
            Open your assessment
          </Link>
          <p>
            If prompted, sign in and select the client associated with this
            assessment.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">
            Payment confirmed. Set up secure access.
          </h2>
          <p>
            Already have a PK account? Sign in with the purchase email, then
            return here to connect this assessment. Your existing password will
            stay unchanged.
          </p>
          <Link className="underline" href="/portal/login">
            Sign in to PK
          </Link>
          <button
            className="block rounded border px-4 py-3"
            disabled={busy}
            onClick={() =>
              void action(() => finish({ useExistingAccount: true }))
            }
          >
            Connect my signed-in PK account
          </button>
          <hr />
          <h2 className="text-xl font-semibold">New to PK?</h2>
          <p>
            Verify the email used for this purchase, then choose a password.
            Never enter taxpayer records or bank credentials here.
          </p>
          <button
            className="rounded border px-4 py-3"
            disabled={busy}
            onClick={() =>
              void action(async () => {
                await readinessFetch("/api/readiness/onboard", undefined, {
                  action: "SEND_CODE",
                });
                setCodeSent(true);
                setMessage("Check your purchase email for the one-time code.");
              })
            }
          >
            Send verification code
          </button>
          {codeSent && (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                const fields = new FormData(event.currentTarget);
                void action(() =>
                  finish({
                    code: fields.get("code"),
                    password: fields.get("password"),
                  }),
                );
              }}
            >
              <label className="block">
                Email verification code
                <input
                  className="mt-2 block w-full rounded border p-3"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  required
                />
              </label>
              <label className="block">
                New PK password (12–72 characters)
                <input
                  className="mt-2 block w-full rounded border p-3"
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={72}
                  required
                />
              </label>
              <button
                className="rounded bg-pink-700 px-4 py-3 text-white"
                disabled={busy}
              >
                Create secure access & start intake
              </button>
            </form>
          )}
        </div>
      )}
      <RecoverSetup onRecovered={refresh} />
    </section>
  );
}
