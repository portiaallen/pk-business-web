import type { Metadata } from "next";
import Link from "next/link";
import { IntakeForm } from "../IntakeForm";

export const metadata: Metadata = {
  title: "Start the roast | Aunt Penny, Roast My Books!",
  robots: { index: false, follow: false },
};

export default function StartPage() {
  return (
    <main className="min-h-screen px-5 py-14 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <p className="ap-eyebrow">Aunt Penny, Roast My Books!</p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">The intake</h1>
        <p className="mt-3 opacity-85">
          Figures only, baby. No statements, no screenshots, no documents. Every field is
          scored right here in your browser.
        </p>
        <p className="mt-2 text-sm opacity-70">
          <Link href="/auntpenny/roastmybooks">Back to what this is</Link>
        </p>
        <IntakeForm />
      </div>
    </main>
  );
}
