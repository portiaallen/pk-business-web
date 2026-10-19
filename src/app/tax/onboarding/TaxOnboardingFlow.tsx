"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Client-facing tax intake flow. Talks to the intake API routes, which run
// server-side reject-before-persistence screening; this UI never collects
// SSNs, ITINs, IP PINs, or bank details, and never posts a file.
// Free-text wording stays clear of tax-document keywords (the server screens
// for them, so even option labels must not read like "W-2" or "1099").

type Mode = "synthetic" | "encrypted";

interface AnswerResponse {
  recorded?: boolean;
  mode?: Mode;
  flags?: { code: string; message: string; severity: string }[];
  ddTriggers?: string[];
  checklist?: { id: string; label: string; done: boolean }[];
  pending?: string[];
}

interface IdentityStateShape {
  status: "none" | "requested" | "verified" | "rejected";
  documentsSubmitted: boolean;
  docCount: number;
}

interface GatesResponse {
  ok?: boolean;
  gates?: Record<string, unknown>;
  identity?: IdentityStateShape;
  mode?: Mode;
}

interface ApiErrorShape {
  error?: string;
  findings?: string[];
  note?: string;
}

const FILING_YEARS = [
  { value: 2025, label: "Last year (2025)" },
  { value: 2024, label: "The year before (2024, catch-up)" },
  { value: 2026, label: "This year, planning ahead (2026)" },
];

// Collected in this flow. Key names stay clear of the server's sensitive
// key patterns; option labels stay clear of tax-document keywords.
const QUESTIONS: {
  key: string;
  label: string;
  type: "text" | "select";
  options?: string[];
  placeholder?: string;
}[] = [
  {
    key: "taxpayer_and_spouse_legal_identity",
    label: "Who is filing this return?",
    type: "select",
    options: ["Just me", "Me and my spouse"],
  },
  {
    key: "contact",
    label: "Best way to reach you",
    type: "text",
    placeholder: "Email or phone is fine",
  },
  {
    key: "address",
    label: "Roughly where are you? (city and state is enough to start)",
    type: "text",
    placeholder: "City, State",
  },
  {
    key: "marital_status_dec31",
    label: "Marital status on December 31 of the tax year",
    type: "select",
    options: [
      "Single",
      "Married, filing together",
      "Married, filing separately",
      "Head of household",
      "Not sure yet",
    ],
  },
  {
    key: "filing_history",
    label: "Did you file a return for the previous year?",
    type: "select",
    options: ["Yes", "No", "Not sure"],
  },
  {
    key: "income_screening",
    label: "What kinds of income did you have? (pick the closest)",
    type: "select",
    options: [
      "Payroll job",
      "Self-employed, freelance, or gig",
      "Investments or rental property",
      "Retirement income",
      "Several of these",
      "None of these",
    ],
  },
  {
    key: "dependents",
    label:
      "Anyone you support? A first name or nickname and how they're related is enough. No birth dates or ID numbers here.",
    type: "text",
    placeholder: "e.g. my daughter, my mother",
  },
  {
    key: "household_living_arrangements",
    label: "Who lived in your home during the tax year?",
    type: "text",
    placeholder: "Plain description is fine",
  },
  {
    key: "irs_correspondence",
    label: "Have you received any letters from the IRS about this year?",
    type: "select",
    options: ["No", "Yes", "Not sure"],
  },
  {
    key: "prior_return_and_carryforwards",
    label: "Do you have a copy of your prior-year return?",
    type: "select",
    options: ["Yes", "No", "It's somewhere"],
  },
  {
    key: "estimated_payments",
    label: "Did you make quarterly estimated tax payments?",
    type: "select",
    options: ["Yes", "No", "Not sure"],
  },
  {
    key: "digital_assets",
    label: "Any crypto or digital-asset activity during the year?",
    type: "select",
    options: ["No", "Yes", "Not sure"],
  },
  {
    key: "foreign_multistate",
    label: "Foreign accounts, or income earned in more than one state?",
    type: "select",
    options: ["No", "Yes", "Not sure"],
  },
  {
    key: "marketplace_coverage_per_household_member",
    label: "Did anyone in your household have marketplace health coverage?",
    type: "select",
    options: ["Yes, all year", "Part of the year", "No", "Not sure"],
  },
  {
    key: "blindness_taxpayer",
    label: "Are you legally blind?",
    type: "select",
    options: ["No", "Yes"],
  },
  {
    key: "blindness_spouse",
    label: "Is your spouse legally blind?",
    type: "select",
    options: ["No", "Yes", "Not applicable"],
  },
];

// Screened out server-side by design: identity and bank data move through
// PK's secure client process after the client relationship starts. The UI
// names them, never collects them.
const SECURE_ITEMS: { key: string; label: string }[] = [
  { key: "dob", label: "Dates of birth (you and your spouse)" },
  { key: "taxpayer_ids", label: "Social Security and ITIN numbers" },
  { key: "ip_pin_status", label: "IP PIN status" },
  { key: "bank_refund_or_payment_election", label: "Refund or payment method" },
];

const NOT_OPEN =
  "Intake isn't open yet. PK is finishing the secure setup behind this page — check back soon or use the contact page to reach PK directly.";

export function TaxOnboardingFlow() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [taxYear, setTaxYear] = useState<number>(2025);
  const [mode, setMode] = useState<Mode | null>(null);
  const [notOpen, setNotOpen] = useState(false);
  const [rejection, setRejection] = useState<string | null>(null);
  const [status, setStatus] = useState<AnswerResponse | null>(null);
  const [gates, setGates] = useState<Record<string, unknown> | null>(null);
  const [identity, setIdentity] = useState<IdentityStateShape | null>(null);
  const [docName, setDocName] = useState("");
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const start = async () => {
    setNotOpen(false);
    setRejection(null);
    try {
      const res = await fetch("/api/tax/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taxYear }),
      });
      if (res.status === 503) {
        setNotOpen(true);
        return;
      }
      if (!res.ok) {
        setRejection("PK couldn't start the intake. Please try again.");
        return;
      }
      const data = (await res.json()) as { sessionId: string; mode: Mode };
      setSessionId(data.sessionId);
      setMode(data.mode);
    } catch {
      setRejection("PK couldn't start the intake. Please try again.");
    }
  };

  const handleApiProblem = useCallback(async (res: Response): Promise<boolean> => {
    if (res.status === 503) {
      setNotOpen(true);
      return true;
    }
    if (res.status === 404) {
      setSessionId(null);
      setRejection("This intake session expired. Start again below.");
      return true;
    }
    if (res.status === 422) {
      const data = (await res.json().catch(() => ({}))) as ApiErrorShape;
      setRejection(
        "That entry was blocked: sensitive information doesn't belong on this page. " +
          (data.note ?? "It moves through PK's secure client process after you become a client."),
      );
      return true;
    }
    return false;
  }, []);

  const saveAnswer = async (key: string, value: string) => {
    if (!sessionId || !value) return;
    setRejection(null);
    try {
      const res = await fetch("/api/tax/answer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, key, value }),
      });
      if (await handleApiProblem(res)) return;
      if (!res.ok) {
        setRejection("PK couldn't save that answer. Please try again.");
        return;
      }
      const data = (await res.json()) as AnswerResponse;
      setSaved((prev) => ({ ...prev, [key]: true }));
      setStatus(data);
      if (data.mode) setMode(data.mode);
    } catch {
      setRejection("PK couldn't save that answer. Please try again.");
    }
  };

  const documentAction = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!sessionId) return;
    setRejection(null);
    try {
      const res = await fetch("/api/tax/documents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, action, ...extra }),
      });
      if (await handleApiProblem(res)) return;
      if (!res.ok) {
        setRejection("That step didn't go through. Please try again.");
        return;
      }
      const data = (await res.json()) as GatesResponse;
      if (data.gates) setGates(data.gates);
      if (data.identity) setIdentity(data.identity);
      if (data.mode) setMode(data.mode);
    } catch {
      setRejection("That step didn't go through. Please try again.");
    }
  };

  const gateState = (key: string): boolean =>
    Boolean(gates && (gates as Record<string, unknown>)[key] === true);

  if (!sessionId) {
    return (
      <div className="rounded-xl border border-charcoal/15 bg-white p-6 shadow-sm">
        {notOpen ? (
          <p className="text-sm text-charcoal/80" role="alert">{NOT_OPEN}</p>
        ) : null}
        {rejection ? (
          <p className="mt-3 text-sm text-red-700" role="alert">{rejection}</p>
        ) : null}
        <div className="mt-2">
          <Label htmlFor="tax-year">Which tax year?</Label>
          <select
            id="tax-year"
            className="mt-2 w-full rounded-md border border-charcoal/20 bg-white px-3 py-2 text-sm"
            value={taxYear}
            onChange={(e) => setTaxYear(Number(e.target.value))}
          >
            {FILING_YEARS.map((y) => (
              <option key={y.value} value={y.value}>{y.label}</option>
            ))}
          </select>
        </div>
        <Button className="mt-4" onClick={start}>Start intake</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {mode === "synthetic" ? (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Preview mode: this walkthrough stores nothing and sends nothing.
        </p>
      ) : null}
      {notOpen ? (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">{NOT_OPEN}</p>
      ) : null}
      {rejection ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{rejection}</p>
      ) : null}

      <div className="rounded-xl border border-charcoal/15 bg-white p-6 shadow-sm">
        <h2 className="pk-serif text-xl font-semibold">1. A few questions</h2>
        <p className="mt-1 text-sm text-charcoal/70">
          Answer what you can; skip what you can&apos;t. PK reads everything before
          your first appointment.
        </p>
        <div className="mt-4 space-y-4">
          {QUESTIONS.map((q) => (
            <div key={q.key} className="grid gap-2">
              <Label htmlFor={`q-${q.key}`}>
                {q.label}
                {saved[q.key] ? <span aria-hidden> — saved</span> : null}
              </Label>
              {q.type === "select" ? (
                <select
                  id={`q-${q.key}`}
                  className="w-full rounded-md border border-charcoal/20 bg-white px-3 py-2 text-sm"
                  value={answers[q.key] ?? ""}
                  onChange={(e) => {
                    setAnswers((prev) => ({ ...prev, [q.key]: e.target.value }));
                    void saveAnswer(q.key, e.target.value);
                  }}
                >
                  <option value="">Choose…</option>
                  {q.options?.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <Input
                  id={`q-${q.key}`}
                  value={answers[q.key] ?? ""}
                  placeholder={q.placeholder}
                  onBlur={(e) => void saveAnswer(q.key, e.target.value)}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [q.key]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-lg bg-charcoal/5 p-4">
          <h3 className="text-sm font-semibold">Collected later, the secure way</h3>
          <p className="mt-1 text-sm text-charcoal/70">
            These are part of every return, but they never touch this page:
          </p>
          <ul className="mt-2 space-y-1 text-sm text-charcoal/80">
            {SECURE_ITEMS.map((s) => (
              <li key={s.key}>• {s.label}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-charcoal/70">
            After you become a client, PK&apos;s secure client process collects them
            with identity verification.
          </p>
        </div>
      </div>

      {status?.flags?.length ? (
        <div className="rounded-xl border border-charcoal/15 bg-white p-6 shadow-sm">
          <h2 className="pk-serif text-xl font-semibold">What PK sees so far</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {status.flags.map((f, i) => (
              <li key={`${f.code}-${i}`} className="rounded-lg bg-charcoal/5 p-3">
                <span className="font-semibold">{f.code}</span>
                <span className="ml-2 text-charcoal/70">{f.message}</span>
              </li>
            ))}
          </ul>
          {status.pending?.length ? (
            <p className="mt-3 text-sm text-charcoal/70">
              Still open: {status.pending.join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-xl border border-charcoal/15 bg-white p-6 shadow-sm">
        <h2 className="pk-serif text-xl font-semibold">2. Identity and documents</h2>
        <p className="mt-1 text-sm text-charcoal/70">
          A PK preparer personally reviews who you are before anything else
          opens. Names and descriptions only here — never card numbers, ID
          numbers, or file contents.
        </p>
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4 rounded-lg bg-charcoal/5 p-3">
            <span>Ask PK to verify your identity</span>
            <Button
              variant="outline"
              size="sm"
              disabled={identity !== null && identity.status !== "none"}
              onClick={() => void documentAction("verify")}
            >
              {identity?.status === "verified"
                ? "Verified by PK"
                : identity?.status === "requested"
                  ? "With your PK preparer"
                  : identity?.status === "rejected"
                    ? "Not verified — contact PK"
                    : "Request review"}
            </Button>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg bg-charcoal/5 p-3">
            <span>Secure document access</span>
            <span className="text-charcoal/70">
              {gateState("accessGranted")
                ? "Open"
                : "PK opens this after reviewing your intake"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg bg-charcoal/5 p-3">
            <span>Submit ID documents through the secure process</span>
            <Button
              variant="outline"
              size="sm"
              disabled={!gateState("accessGranted") || gateState("identityVerified") || (identity?.documentsSubmitted ?? false)}
              onClick={() => void documentAction("identity_docs")}
            >
              {gateState("identityVerified")
                ? "Reviewed"
                : identity?.documentsSubmitted
                  ? `Submitted (${identity.docCount})`
                  : "Submit"}
            </Button>
          </div>
          <div className="rounded-lg bg-charcoal/5 p-3">
            <div className="flex items-center justify-between gap-4">
              <span>Log a document you&apos;ll bring (name only)</span>
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                value={docName}
                placeholder="e.g. last year's return, income records"
                onChange={(e) => setDocName(e.target.value)}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={!gateState("accessGranted") || !docName.trim()}
                onClick={() => {
                  void documentAction("upload", { meta: { name: docName.trim() } });
                  setDocName("");
                }}
              >
                Log
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg bg-charcoal/5 p-3">
            <span>Attest: what PK has is complete and true</span>
            <Button
              variant="outline"
              size="sm"
              disabled={!gateState("accessGranted") || gateState("attested")}
              onClick={() => void documentAction("attest")}
            >
              {gateState("attested") ? "Attested" : "Attest"}
            </Button>
          </div>
        </div>
      </div>

      <p className="text-xs text-charcoal/60">
        Session {sessionId}
        {mode ? ` · ${mode === "synthetic" ? "preview" : "secure"} storage` : ""}
      </p>
    </div>
  );
}
