"use client";
export function PrintReportButton() {
  return <button type="button" className="ap-cta" onClick={() => window.print()}>Print / Save as PDF</button>;
}
