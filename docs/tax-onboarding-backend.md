# PK Tax Division: onboarding backend (synthetic-only, v0.9)

Implements the founder-approved October 16, 2026 architecture correction: PK's
own website and validated restricted backend/vault run the entire client-facing
onboarding and secure document intake; TaxSmart Pro is return preparation and
e-filing only.

## What this PR adds (all additive; no existing files changed except one package.json test script)

- `src/lib/tax/onboarding-core.ts` - the complete conditional intake rule set:
  universal intake questions, dependent branches, CTC/ODC cutoffs, PK residency
  evidence for children 17 and under, college students 17-24, 1098-T student
  name check, qualifying-relative path, custody/Form 8332, Head of Household,
  blindness, 65th birthday rule (including the IRS January 1 convention),
  Marketplace/1095-A, IP PIN states, self-employment/1099-K, contradiction
  flags, Form 8867 due-diligence triggers independent of the dependents answer,
  preparer review gate, six transmission gates, and a full audit trail.
  Sensitive identifiers are never stored; they are logged only as
  SECURE_ROUTE requirements.
- `src/lib/tax/intake-screen.ts` - reject-before-persistence screening that
  reuses the vetted detector in `src/lib/sensitive-data.ts` (the same control
  guarding /api/contact) and adds sensitive field-NAME detection.
- `src/app/api/tax/onboarding`, `answer`, `documents`, `preparer` - Next.js
  route handlers, screening first, fail-closed access control. The preparer
  route refuses every request unless `PK_PREPARER_KEY` is configured (a
  synthetic-build stand-in; production must wire it to the repository's
  existing admin/WebAuthn session authentication).
- `src/lib/tax/session-store.ts` - synthetic in-memory session store.
- `scripts/test-tax-onboarding.mts` - 29-case synthetic battery.

## Boundaries

- Synthetic data only. No real taxpayer data is accepted, stored, or transmitted.
- No production publication, live intake, or e-filing until security validation
  and founder sign-off.
- The production storage adapter (restricted backend/vault with encryption at
  rest, enforced access logs, and revocation) is owner-configured and NOT part
  of this PR. No real file writes occur in this build.
- No production TaxSmart connection exists here; no auto-filing at any stage.

## Not implemented in this PR (stated precisely)

- Real authentication/identity verification integration.
- Production storage adapter for uploads (owner-configured).
- Preparer notification delivery (email/SMS plumbing).
- Client-facing UI wiring on the live PK site.
- The synthetic session store swapped for the persisted session layer.
