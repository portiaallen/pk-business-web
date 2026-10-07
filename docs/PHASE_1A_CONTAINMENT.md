# Phase 1A — Existing Application Containment

Status: implemented and validated locally on `feat/pk-would-work-here`; not a deployment or confidential-vault acceptance. Base commit: `26290362b3bb798be6522f32ea142130e1663a9a`. Portia approved Phase 1A only. No Phase 1B/1C or TaxCase implementation was performed.

## Plan and implemented behavior

- External AI: remove Anthropic calls from engagement review and deny external chat before context access or writes. Keep the local rule review functional. No provider credential can re-enable the removed path. The installed dependency alone is not a callable engagement integration.
- Email: consultation notices contain generic text only, with no description, names, contact payload, or reply-to; intake persistence remains first. Invoice email and persisted notification content omit amounts, names, invoice descriptions, payment terms, and untrusted URLs. Detailed invoices remain in the authenticated portal. Provider error bodies and recipient details are not retained in delivery results. Existing admin reset delivery remains an explicit identity workflow, not document transport.
- Logs/audits: one content-free event logger; exception bodies, messages, stack traces, and provider output are not accepted. Main audit metadata uses an allowlist; client names, emails, notes, filenames, nested change contents, and arbitrary text are dropped. Client updates preserve changed-field names and status transitions. AI activity retains action/actor evidence with no free-text detail. Existing scoped business notes/findings remain business records, not application debug logs. Prisma automatic error/query logging is disabled in both applications.
- Staff file access: existing assignedStaffId is the interim authorization boundary. Staff can download documents and access/upload deliverables only for assigned requests with an active client. Admin access also requires an active client. Checks occur before object reads. Existing admin-only list/detail and release rules remain. Capability grants and MFA remain Phase 1B.
- Client context: central active-client/membership resolution for previously divergent portal APIs. Internal STAFF/ADMIN cannot use client membership as an assignment bypass. Exactly one membership is required until Phase 1B implements explicit selection. Zero, inactive, and ambiguous memberships are denied rather than guessing. Existing client member write/management restrictions remain.
- Sessions: main and inventory use distinct host-only cookie names and verifier domains. Malformed/duplicate cookie credentials are rejected. Production/preview require the approved auth-secret environment binding. Expiry and account status remain server-enforced. Main logout revokes the hashed session and audits its verified actor. Reset verifiers are domain-separated and require the same environment guard.
- Request/cache controls: browser mutations require same Origin; verified Stripe webhook and local setup are explicit exceptions. Portal, admin, API, b2b and reset paths have private/no-store headers; reset links do not emit referrers. b2b aliases share the portal page guard. PWA caches only existing static/offline content. The public manifest no longer embeds a request-specific shortcut.
- Environment: explicit environment/resource declarations gate remote database, storage, auth and email use. Database providers are restricted to implemented file/libSQL adapters. Production cannot use a local database. Live Stripe keys are accepted only in production, test keys only in non-production, with matching Stripe declarations. Public card availability, checkout, and webhook use the same readiness check. Invoice pricing/balance/signature validation logic is preserved.
- R2: approved HTTPS account-specific R2 API endpoint only; no credential transmission to arbitrary endpoints. New legacy document keys omit original filenames. Existing keys/files are not changed. This is containment, not a separate vault.
- Setup/tools: seed endpoint and synthetic seed scripts require explicit local opt-in and local file storage; hosted/production/remote seeding is denied. Schema utilities require a separate non-production opt-in. Inventory request handling cannot automatically create schema or grant OWNER membership.
- Inventory: separate cookie/verifier, separately declared resource bindings, no automatic owner grant, no request-time migration, and content-free errors. No PK confidential permission is inherited from inventory authentication.
- CI: replace paused workflow with containment tests, main build/type checks, and targeted security lint. Workflow was validated locally; no GitHub execution/publication is claimed. Generated artifacts are excluded from lint, including nested inventory build output; handwritten source remains included.

## Regression implications

- All prior sessions and outstanding reset links require fresh sign-in/reset after an eventual authorized release, because verifier domains changed. Old cookies are not trusted. No production sessions were altered here.
- Shared-cookie login to Inventory is intentionally removed. Inventory needs its own authentication and explicit membership provisioning; no auto-OWNER fallback.
- Clients with multiple memberships are intentionally denied until explicit client selection is delivered in Phase 1B.
- Unassigned staff and inactive-client file access are denied. Archival/legal-hold access policy is a later controlled capability decision.
- Browser fetches send Origin normally. Legacy curl/Python test tools must send matching Origin and use the new cookie before reuse; they were not executed because their fixtures are not approved as synthetic-only for this task.
- Emails now direct recipients to sign in rather than embedding financial/client details. Existing payment delivery-success bookkeeping and consultation persistence behavior remain.
- Missing/new environment declarations fail closed. Production settings were not inspected or changed. This branch must not be released by merely copying labels onto unverified shared resources.
- Historical database logs/notifications, existing filename-bearing keys, retained objects, and data are unchanged. Any cleanup requires a separately authorized operational plan.

## Configuration and release prerequisites (no settings changed)

`PK_ENVIRONMENT`: production, preview, development, or test. It must match VERCEL_ENV when hosted. A hosted or production runtime cannot silently default to development.

Required matching declarations when each resource is used:

- `PK_DATABASE_ENVIRONMENT`
- `PK_STORAGE_ENVIRONMENT`
- `PK_AUTH_ENVIRONMENT`
- `PK_EMAIL_ENVIRONMENT`
- `PK_STRIPE_ENVIRONMENT`

Inventory uses `PK_INVENTORY_DATABASE_ENVIRONMENT` and `PK_INVENTORY_AUTH_ENVIRONMENT` with independent scoped credentials/resources. Actual provider-side separation is still UNKNOWN and must be verified by the authorized operator. Matching labels are guards, not evidence of isolation.

Local synthetic setup requires `PK_ALLOW_SYNTHETIC_SETUP=true`, a local file database, and a non-hosted/non-production runtime. Schema utilities separately require `PK_ALLOW_SCHEMA_CHANGE=true` and an explicit development/test environment. No such utility was run against a database during this assignment.

Before eventual release Portia must approve/verify resource mapping, restricted credentials, new sign-in behavior, inventory provisioning, and multi-client/archived-access policies. No confidential upload expansion is authorized by this work.

## Validation

All runtime fixtures and provider responses were synthetic. Auth/database/object/email/Stripe boundaries were mocked for regression tests; no real charge, client upload, email, or production call was made.

- `npm run test:security:phase1a`: 63 containment tests and 18 existing configuration/checkout checks passed.
- Main production build: passed.
- Main TypeScript: passed.
- Inventory production build and TypeScript: passed after generating its local Prisma client; generation applies no database schema.
- Relevant changed-file/security lint: zero errors; three pre-existing unused-variable warnings in invoice, QB review, and team APIs.
- Full repository lint: pre-existing handwritten-source failures remain, 21 errors / 40 warnings. The earlier baseline was 24 errors / 43 warnings; this work removes three false hook-name errors in the storage helper and unused seed warnings. Nested generated build output initially caused extra lint noise during validation; generated-only ignores were corrected and the source result rerun.
- Main browser: 28 checks passed at 390/768/1440 widths; public pages/portal login, no overflow, anonymous API denial and no-store responses, b2b guards, cross-origin denial, setup denial, and intercepted synthetic consultation success. Zero page errors; consultation axe checks found zero WCAG A/AA violations.
- Pay browser: 13 checks passed across configured/missing/key-only/webhook-only states at mobile/tablet/desktop; zero overflow/WCAG violations; authenticated portal/Stripe navigation mocked and intercepted. No charge or real invoice.
- Built public JavaScript scan for server credential-variable names returned no matches. This is a bounded build check, not a claim that historical repository secrets or provider logs have been comprehensively scanned.
- Diff whitespace checks passed. Existing approved branding assets/styles and schemas are unchanged.

Browser evidence: `docs/phase1a/browser-checks.json`, `docs/phase1a/payment-checks.json`.

## Remaining gates / limits

Phase 1A local containment acceptance passed. Provider resource isolation, deployed headers/configuration, and actual Samsung hardware behavior are not established by local tests. No release approval is implied.

Phase 1B remains: staff MFA, step-up, complete recovery, capability grants, permission-change/offboarding controls, and explicit client selection.

Phase 1C remains: segregated private vault/quarantine, byte validation/scanning, clean release, full access auditing, retention/holds, verified disposal, backup and authorized restore evidence. The current document center is not the approved vault. No confidential upload expansion may ship before that acceptance gate passes.

No deployment, push, publication, merge, production configuration/data change, schema change, or real confidential data use occurred. Stop after Phase 1A and return to Portia.

## Exact changed-file inventory

- `.github/workflows/ci.yml`
- `apps/inventory-tracker/src/server/auth/constants.ts`
- `apps/inventory-tracker/src/server/auth/session.ts`
- `apps/inventory-tracker/src/server/db/apply-turso-schema.ts`
- `apps/inventory-tracker/src/server/db/client.ts`
- `apps/inventory-tracker/src/server/errors/api-error.ts`
- `apps/inventory-tracker/src/server/inventory/auth.ts`
- `apps/inventory-tracker/src/server/security-environment.ts`
- `docs/PHASE_1A_CONTAINMENT.md`
- `docs/phase1a/browser-checks.json`
- `docs/phase1a/payment-checks.json`
- `eslint.config.mjs`
- `next.config.ts`
- `package.json`
- `public/manifest.webmanifest`
- `scripts/apply-schema-turso.ts`
- `scripts/push-schema-if-turso.mjs`
- `scripts/seed-demo.ts`
- `scripts/seed-security-test.ts`
- `scripts/test-card-checkout.mjs`
- `scripts/test-phase1a.mjs`
- `src/app/api/admin/clients/[id]/route.ts`
- `src/app/api/admin/clients/route.ts`
- `src/app/api/admin/documents/[id]/route.ts`
- `src/app/api/admin/documents/route.ts`
- `src/app/api/admin/intake-submissions/route.ts`
- `src/app/api/admin/invoices/[id]/route.ts`
- `src/app/api/admin/requests/[id]/ai-assistant/route.ts`
- `src/app/api/admin/requests/[id]/deliverables/[deliverableId]/route.ts`
- `src/app/api/admin/requests/[id]/deliverables/route.ts`
- `src/app/api/admin/requests/[id]/document-requests/route.ts`
- `src/app/api/admin/requests/[id]/notes/route.ts`
- `src/app/api/admin/requests/[id]/qb-review/route.ts`
- `src/app/api/admin/requests/[id]/reply/route.ts`
- `src/app/api/admin/requests/[id]/route.ts`
- `src/app/api/admin/requests/[id]/time-entries/route.ts`
- `src/app/api/admin/services/route.ts`
- `src/app/api/admin/team/route.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/app/api/contact/route.ts`
- `src/app/api/portal/dashboard/route.ts`
- `src/app/api/portal/documents/[id]/route.ts`
- `src/app/api/portal/documents/route.ts`
- `src/app/api/portal/documents/upload/route.ts`
- `src/app/api/portal/invoices/[id]/checkout/route.ts`
- `src/app/api/portal/invoices/route.ts`
- `src/app/api/portal/members/route.ts`
- `src/app/api/portal/payments/route.ts`
- `src/app/api/portal/requests/[id]/route.ts`
- `src/app/api/portal/requests/route.ts`
- `src/app/api/setup/seed/route.ts`
- `src/app/api/stripe/webhook/route.ts`
- `src/components/forms/ConsultationForm.tsx`
- `src/lib/ai/activity.ts`
- `src/lib/ai/review-engine.ts`
- `src/lib/api-error.ts`
- `src/lib/auth.ts`
- `src/lib/contact-email.ts`
- `src/lib/document-access.ts`
- `src/lib/invoices.ts`
- `src/lib/password-reset.ts`
- `src/lib/prisma.ts`
- `src/lib/security-environment.ts`
- `src/lib/security-log.ts`
- `src/lib/storage-r2.ts`
- `src/lib/storage.ts`
- `src/proxy.ts`
