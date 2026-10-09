# Readiness landing page — 7 October 2026

Branch: `feat/readiness-landing-page`. Base: `26290362b3bb798be6522f32ea142130e1663a9a`.

## Scope and gate

This change integrates the owner-supplied `pk-readiness-standalone.html` into `/readiness`. It is a landing-page implementation, not completion of the master product assignment. Full-product launch gate: **RED / INCOMPLETE**. Do not promote it as a purchasable assessment.

The eight canonical Drive documents were retrieved and read before coding: specifications 00–05, Official Product & Credit Policy v1.0, and CODEX MASTER IMPLEMENTATION PROMPT v1.0. Implementation folder: https://drive.google.com/drive/folders/1NPKgNAg3zmWN_Q_oDHT_b7_Ecx66ZOU5.

## Repository inspection

This branch is based on current main and matches the published `feat/pk-would-work-here` tip. The later security implementation described in Drive is not present here. Do not infer that the recorded qualification code or its controls are on this branch.

Existing primitives include Next.js App Router; Prisma 7 with SQLite/libSQL; User/Session/Client/ClientMember roles; `/admin` Command Center; `/portal` client workspace; ordinary Document/DocumentRequest and Deliverable records; Invoice/Payment; signed Stripe webhook and invoice-specific card checkout; Notification and AuditLog models. Existing Stripe purchase processing expects an existing client invoice, not an anonymous assessment checkout. The closed, qualified Vault workflow described in Drive is not available on this checkout. Existing security qualification remains a separate unresolved gate.

No database schema/migration, authentication, payment, document, invoice or admin behavior changes were made. The full master assignment still requires secure-base reconciliation, a readiness domain model, verified/idempotent purchase processing, protected intake/submission, secure documents, capability-gated admin fulfillment and recommendation library, QA/frozen reports, secure delivery, credit lifecycle, audit and non-sensitive analytics.

## Implementation

- `src/content/readiness.html`: approved Arena document; retains styling, personality, responsive structure, gut check, sample report, FAQ, scope and CTAs. Corrects business/self-employment audience language, claim/approval/redemption policy and pre-purchase refund disclosure. Removes prototype disclosures, simulated success, inactive intake fields and copied Cloudflare injection/email encoding. Direct PK contact links restored.
- `public/readiness/`: eleven original embedded fonts/images extracted without altering their bytes.
- `src/app/readiness/route.ts`: HTML response avoids shared layout interference. Script hashes restrict executable scripts; network connections and form submission are disabled. No intake is collected. All assessment CTAs show checkout unavailable and PK contact information. No-JavaScript users receive an availability/contact message. Service offer availability is OutOfStock until the real product is enabled.
- `next.config.ts`: explicit HTML file tracing for packaged deployments.
- `package.json` / lock: Playwright development dependency for browser verification.
- `scripts/test-readiness.mjs`: browser checks and screenshot capture. Uses READINESS_TEST_ORIGIN, default http://localhost:4321.

The share image uses the original local hero image and an absolute production URL. A separately approved 1200×630 social crop is still outstanding. Analytics seams remain inactive; no analytics integration or complete funnel measurement is claimed.

## Validation

- `npx prisma generate`: PASS.
- `npx tsc --noEmit`: PASS.
- `npx eslint src/app/readiness/route.ts next.config.ts scripts/test-readiness.mjs`: PASS.
- `npm run build`: PASS; /readiness is present and the HTML is included in route file tracing. Two pre-existing storage.ts tracing warnings remain.
- `node scripts/test-card-checkout.mjs`: 18 checks PASS; mocked Stripe/auth/database, no real charge.
- `node scripts/test-readiness.mjs`: PASS at 375/768/1440px against development. All images/fonts load; no horizontal overflow; gut check is private with no storage; keyboard report tabs, FAQ and all CTA dialogs/Escape work; metadata matches canonical route/$99 USD; no browser errors or external requests.
- `READINESS_TEST_ORIGIN=http://localhost:4322 node scripts/test-readiness.mjs`: same checks PASS at all three widths against the production server (`next start`). This is local production-build validation, not a deployed smoke test.
- Screenshots: `docs/readiness/evidence/readiness-375.png`, `readiness-768.png`, `readiness-1440.png`.

Reproduce browser checks: `npx playwright install chromium`, start the application, then run the test script. Screenshots intentionally expand reveal sections for full-page evidence.

## Production impact and remaining acceptance

No deployment, DNS change, real payment, customer email or customer-data processing occurred. No additional runtime environment variables are required for this page. Landing-page checks do not satisfy the canonical 30-test full lifecycle acceptance matrix. Payment integrity, authorization, sensitive-document handling, final refund acknowledgment persistence, report delivery/snapshots and credit lifecycle remain unimplemented here. Production smoke testing is not claimed.

GitHub publication attempt failed HTTP 403 (permission denied). The remote branch remains at its base; the implementation is committed locally. A verified incremental Git bundle is provided separately for owner publication, preserving the exact tested code without sharing credentials.
