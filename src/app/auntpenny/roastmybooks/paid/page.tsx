import Link from "next/link";
export const metadata = { title: "Payment verification | Aunt Penny", robots: { index: false, follow: false } };
export default function PaidPendingPage() {
  return <main className="mx-auto max-w-xl px-6 py-20"><h1 className="text-3xl font-bold">Aunt Penny is checking the receipt.</h1><p className="mt-4">Payment confirmation and report delivery are not yet available in this sandbox preview. No purchase is needed to use the free roast.</p><Link href="/auntpenny/roastmybooks/start">Return to the free roast</Link></main>;
}
