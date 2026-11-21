"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";

export default function RecoverAuntPennyReport() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auntpenny/recover", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }), cache: "no-store"
      });
      setMessage(response.ok ? "If your verified purchase matches, a private link will arrive by email." : "Report recovery is temporarily unavailable. Please try again later.");
    } catch {
      setMessage("Report recovery is temporarily unavailable. Please try again later.");
    } finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-xl px-6 py-16">
    <p className="ap-eyebrow">PK Business Services Original · Aunt Penny</p>
    <h1 className="mt-4 text-4xl font-bold">Find your Roast My Books report</h1>
    <p className="mt-4">Enter the email address used at checkout. If a verified sandbox purchase matches, we will send a private link.</p>
    <form onSubmit={submit} className="mt-8 space-y-4">
      <label htmlFor="buyer-email" className="block font-bold">Checkout email</label>
      <input id="buyer-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} className="w-full rounded border p-3 text-black" />
      <button disabled={busy} type="submit" className="rounded bg-amber-400 px-6 py-3 font-bold text-black disabled:opacity-50">{busy ? "Checking…" : "Email my report link"}</button>
    </form>
    {message && <p role="status" className="mt-5">{message}</p>}
    <p className="mt-8"><Link href="/auntpenny/roastmybooks">Return to Roast My Books</Link></p>
  </main>;
}
