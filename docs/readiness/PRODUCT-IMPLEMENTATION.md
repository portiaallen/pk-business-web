# PK Readiness Assessment — implementation and launch gate

Date: 7 October 2026. Branch: `feat/readiness-landing-page`. Product implementation commit: `d11f6b5` (full SHA recorded in the evidence manifest).

**Production launch gate: RED.** The accepted landing checkpoint `dc57767` is not product completion. This handoff extends it with the locally executable lifecycle. No deployment, real charge, customer email, production migration, or real taxpayer-record processing occurred. The implementation is available locally and as a Git bundle in the PK Drive Implementation folder. GitHub publication remains blocked by the recorded HTTP 403.

The local results below do not qualify Stripe, hosted identity/database, private document providers, or delivery operations for production. Purchasing deliberately fails closed outside explicitly opted-in local synthetic environments. Removing that restriction is a release action contingent on the existing PK security qualification, not an ordinary configuration change or a bypass implemented here.

## Canonical authority

Google Drive is the authority. All eight documents were retrieved and read before implementation; the current canonical documentation was reread before extending the checkpoint.

| Authority | Google Drive document |
|---|---|
| 00 — Canonical Product Specification v1.0 | https://docs.google.com/document/d/17GYNs3P9xlpTbfvPjmWMrP9k9lqiwK5bzvH5W3OQS3w/edit |
| 01 — Fulfillment Rubric v1.0 | https://docs.google.com/document/d/1vdSUzkVhVIGd3r3EasfjVQ6wmM2WCO3yjwjvRvOvpBM/edit |
| 02 — Report & Recommendation Specification v1.0 | https://docs.google.com/document/d/1q5lOAw2F5eDkgkU1tDgASZxOu-nERX4fbvcymlNW8Yk/edit |
| 03 — Operations, SLA & Lifecycle v1.0 | https://docs.google.com/document/d/15P4YAvJxA9cmy5cPXPK8zr4Xo4MGN2RCfzxHoDRW6Do/edit |
| 04 — Admin Command Center & Outside Recommendations v1.0 | https://docs.google.com/document/d/1g3lkTpXp77jdbfV3Q27ABd_xHNORxBm_efugjuGibu8/edit |
| 05 — Data, Audit & Acceptance Requirements v1.0 | https://docs.google.com/document/d/1cAKoS0VCyAt2fPAWHZO0KrzW3UefAq5q3biuyuaf-J4/edit |
| Official Product & Credit Policy v1.0 | https://docs.google.com/document/d/1TwIpVpTnsr0aEb2lePFRtJAYugyR0Kv1Yk23DdaqDeg/edit |
| CODEX MASTER IMPLEMENTATION PROMPT v1.0 | https://docs.google.com/document/d/1gV0jD7UlF0ClaDUxmUC3UMlOMv-IfRDmgco9_eT1JUI/edit |

Implementation/evidence folder: https://drive.google.com/drive/folders/1NPKgNAg3zmWN_Q_oDHT_b7_Ecx66ZOU5.

This is an implementation-results document. It does not change the canonical business policy or claim that a later chat summary overrides Drive. `IMPLEMENTATION.md` remains the historical landing checkpoint; its statements about inactive seams describe that earlier commit. The current results are here.

## Existing-system inspection and security reconciliation

The repository uses Next.js App Router, Prisma 7 with SQLite/libSQL, existing User/Session/Client/ClientMember entities, `/admin`, `/portal`, DocumentRequest, Invoice/Payment/InvoiceActivity, signed Stripe webhooks, Notification and AuditLog. Ordinary-file uploads are not an approved confidential-tax workflow.

The accepted landing branch lacked the later approved PK security controls. The existing security baseline `cdbca2e5c1b41ab36c2c827962f7c4b274d19281` was merged at local commit `83fd319`. This reuses its scoped capabilities, WebAuthn and recent-authentication requirements, security-version revocation, active client context, authorization-before-delivery, private response/logging controls, staff Vault boundary and hosted fail-closed conventions. It does not merge destructive initialization scripts or manufacture provider approval.

The Readiness feature extends these primitives. It does not create another identity, client portal, payment ledger, document store or Admin system. New readiness-specific tables hold the domain state, immutable report/recommendation evidence, non-sensitive funnel events and public rate-limit counters.

## Implemented lifecycle

1. `/readiness` retains the approved Arena design, original assets, PK copy/personality, gut check, sample report, FAQ, scope/security language and CTA placement. Purchasing availability is checked before collecting preliminary information. The original intake styling is reused; concern is a controlled choice. Prototype notices and simulated success are absent. The only visual correction after the accepted checkpoint is stronger footer copyright contrast.
2. The preliminary endpoint accepts exactly `name`, `email`, `businessType`, `bookkeeping`, `concern`, `consent`. It rejects unknown price/role fields, sensitive identifier patterns in names, arbitrary concern narratives and unapproved choices. No tax documents, SSN/ITIN, credentials or card data are requested. Names/email and controlled answers are stored in the existing IntakeSubmission primitive.
3. A server-issued HttpOnly, SameSite purchase cookie points to a hashed, expiring purchase token. A retry reuses one assessment and its existing provisional Client, VerificationRequest and exact-$99 Invoice. Browser storage and identity-bearing return URLs are unnecessary.
4. Checkout uses the existing server Stripe HTTP architecture. It fixes 9900 cents/USD, validates the processor response, uses a stable provider idempotency key, checks environment, enforces the exact Stripe checkout hostname, and applies a bounded timeout. Payment metadata contains opaque association identifiers only. An expired checkout is held for PK review rather than starting another charge.
5. The existing signed, timestamp-checked Stripe webhook records payment atomically with the assessment, Invoice, Payment, audit and notification outbox. Unpaid/cancelled, unsigned, wrong amount/currency/mode or mismatched associations cannot mark paid. Replays reuse one assessment/payment. A browser success redirect never marks paid. Duplicate provider references cannot be associated with another purchase.
6. Paid onboarding either binds an authenticated existing CLIENT account with the purchase email or verifies the purchase email with a short-lived hashed one-time code before creating a client account. Wrong codes have persistent attempt limits; existing passwords are never replaced. Existing PK sessions and client-context selection are reused. No verification secret is put in a URL or audit log.
7. The client workspace saves controlled readiness answers and supports final submission. PK may request secure evidence before submission or additional information during review. Required evidence requested before submission must be verified received first.
8. Final submission requires the exact canonical acknowledgment, affirmative acceptance and policy version. It records assessment/customer identity, acknowledgment text, timestamp, submitting user and audit events. Retries do not create another submission. Database triggers prevent rewriting accepted submission evidence.
9. The scoped Admin Command Center has a Readiness queue, paid/incomplete/submitted/awaiting/in-review/draft/QA/delivered/overdue/credit-pending/credit-expiring/outside-usage filters, counts, timestamps and internal aging. It uses the selected authorized client and request grants; it does not bypass the PK context boundary. No public turnaround guarantee is published. The three-business-day target begins when PK moves the assessment into review with required information available and pauses while awaiting information.
10. The assessment editor supports six areas, one or multiple findings per area, rationale/evidence basis/why/action/priority, separate condition status and recommendation disposition, qualifying PK service selection, internal notes, ordering, operational transitions, reminders and factual corrections. Insufficient information and not applicable are explicit; findings are never invented automatically.
11. The Recommendation Library supports create/search/filter/edit/duplicate/activate/deactivate/archive, client-copy preview, versioned usage and internal notes. The default is INFORMATIONAL. Named providers are deliberate and optional. Elevated relationships require explicit selection and disclosure; referral/compensated relationships cannot be activated or used without disclosure. No used entry is hard-deleted.
12. Assessment recommendations support library sources, custom wording, one-offs, optional save to library, multiple resources, ordering, draft removal and replacement with a new snapshot. Replacements retain the old assignment in history. Assignment freezes client-facing fields/disclosure/source version. Library edits or deactivation cannot rewrite the assignment or a final report.
13. Report drafts contain summary, strengths, priorities, limitations and all six reviewed areas. Preview is authenticated and audited. QA requires an audited preview of the exact current draft, complete rubric/rationale and an authorized human checklist. Edits invalidate QA. Finalization creates a frozen version, integrity digest and rendered artifact reference. Only the latest current QA-approved final can be delivered.
14. Successful delivery is atomic publication in the existing authenticated client portal, together with an in-app notification and audit event. The final report must be available to an active client account. A failed authorization, unavailable account, failed audit or transaction failure does not set `reportDeliveredAt` or start credit clocks. Email is a secondary content-free notice; an email outage does not undo a report already accessible in the portal. Report bodies exclude internal notes and escape HTML. No public report URL, bearer download link or document byte route is introduced.
15. First successful final delivery sets `reportDeliveredAt` (semantic `report_delivered_at`), a 14-calendar-day claim deadline, and six calendar months from that same delivery for redemption. Month-end/leap-year dates clamp correctly. Deadlines and displayed timestamps use UTC; the internal business-day calculator counts Monday–Friday because no additional PK holiday calendar is specified. Factual corrections preserve prior versions and do not restart clocks.
16. Credit eligibility comes from a specific report-related PK service. Timely client expression of interest remains pending until explicit PK approval. Rejection records a controlled reason. Approved credit applies once to one matching-client, matching-service, valid USD invoice, capped at $99 and the outstanding balance. It creates a non-cash READINESS_CREDIT Payment in the existing ledger, updates invoice activity/status atomically, and records the credit/payment/invoice linkage. No outside provider, unrelated service, split, transfer, cash conversion, double application or post-expiry application is supported.
17. Provider-confirmed refunds are reconciled through signed refund events; the implementation never issues a charge/refund automatically. A partial provider refund places the assessment on review hold. A full refund updates the purchase ledger and voids unused credit. Already-applied credit remains historical and receives an explicit review event rather than silently reversing a separate invoice. Pre/post-submission administrative refund decisions remain governed by the canonical policy and approved provider/operator process.
18. Existing Notification records form a deduplicated durable outbox with bounded leases, retry/backoff and safe notices for payment, submission, missing information, report delivery and credit decisions. Synthetic email stays in local process memory. Real email requires the existing approved SMTP/resource binding and non-production sink. An authenticated recent-passkey security operator can dispatch pending notices; hosted scheduling/delivery qualification remains a launch gate.
19. The non-sensitive funnel stores only a controlled event name, timestamp and hashed dedupe key. Public events never include gut answers, intake answers, names/email, free text, taxpayer records or credentials. Server purchase/submission/delivery/credit events dedupe by the opaque domain operation. While purchasing is disabled, public analytics acknowledges without touching the unqualified database.

### Exact final acknowledgment

> I understand that once I submit my Assessment for PK review, the $99 Assessment fee is non-refundable. I understand that disagreement with or dissatisfaction with my Readiness Report, findings, results, or recommendations does not qualify me for a refund.

Stored policy reference: `PK_READINESS_OFFICIAL_POLICY_V1_2026_10_06`, mapped to the Official Policy document linked above. The accepted text is stored verbatim, not reconstructed from a later library or policy edit.

## Security and sensitive-document integration

Every assessment read/write/report/credit operation checks a fresh existing session and security version, active client, explicit matching `x-pk-client-context`, membership or exact capabilities. CLIENT VIEWER membership cannot submit/claim. Staff must have WebAuthn assurance, confidential access and the relevant readiness capability; QA and credit actions require recent password/passkey authentication. `ADMIN` alone is not global authority. Recommendation-library access requires explicit global library capabilities; write requires recent authentication. The existing audited security administration now exposes Readiness capability choices and retains its no-self-grant rule.

Secure evidence references existing DocumentRequest and released, same-client/same-engagement VaultDocument records. Linking requires existing Vault authorization, classification/high-risk/tax grants and recent authentication. Tax-source requests retain the tax capability requirement even if a linked document's original classification differs. External receipt records are PK staff attestations of receipt through TaxSmart/MyTaxOffice or an approved PK handoff; they contain opaque references, not URLs/document contents, and require tax authority where relevant.

Direct client Vault upload remains **NOT ENABLED under the existing approved security boundary**. This feature does not invent client Vault grants. It does not put confidential bytes into ordinary Document storage. Legacy generic request editors and ordinary/portal upload routes explicitly reject Readiness requests. Original purchase invoices cannot be edited/paid through generic invoice paths or used to apply a credit. Applied-credit financial history cannot be removed or repriced; normal qualifying-invoice remaining-balance payment and notification operations remain supported. Historical financial records are protected rather than deleted.

The production Vault provider registry remains closed (`src/lib/vault/providers.ts`: no approved production provider is registered). Storage/scanner/key/backup/retention qualification cannot be manufactured by an environment flag or by these local tests. Consequently hosted purchasing is deliberately unavailable until the security release gate is resolved.

## Schema, migration and rollback

`prisma/readiness-migrations/readiness-v1.sql` is a forward migration from the merged PK security baseline. It adds assessment/finding/library/assignment/report/credit/evidence/analytics/rate-limit tables and Notification outbox fields, preserving existing ledger/portal entities. Report and recommendation snapshots are protected by database triggers; accepted acknowledgment and fixed price are immutable. Report deletion is prohibited. Relations preserve historical dependencies with restrictive deletion.

Use a reviewed migration, not `prisma db push`, for this feature: schema push does not install the custom integrity triggers. The existing destructive Turso reinitialization script is not a migration procedure for Readiness and was not run.

A local forward runner is supplied:

```sh
PK_ENVIRONMENT=test PK_ALLOW_SCHEMA_CHANGE=true node scripts/apply-readiness-local.mjs /absolute/path/to/disposable.db
```

It requires an existing local file, rejects production/hosting, takes a SQLite backup, applies the migration transactionally, verifies foreign keys/integrity and records the SQL digest. Replays verify the digest and do nothing. Tests verify ordinary Notification data survives and a broken baseline rolls back all feature tables. The runner cannot touch Turso or deploy anything.

Production migration is **BLOCKED** pending actual database/schema inspection, approved backup/restore qualification and release execution. No production credentials/data were available or touched. Apply the corresponding remote SQL only through the approved PK migration process after qualification; validate every trigger and foreign key on that provider.

Rollback is to disable Readiness purchasing and preserve ledger/report/audit records, then use an approved consistent backup only if recovery is necessary. Do not drop feature tables or downgrade to code that does not understand READINESS_CREDIT after credits exist. A production backup restoration/disposal procedure cannot be qualified against a disposable SQLite fixture.

## Actual validation and evidence

The final logs are under `docs/readiness/evidence/`. Synthetic fixture values are clearly marked; no production credentials or database dumps are included. Browser tests intercept the Node Stripe transport and the checkout navigation, then exercise actual local HTTP routes, signed webhooks and disposable SQLite. They do not merely mock the assessment API. Staff MFA sessions in the browser test are seeded synthetic fixtures; they are not proof of real passkey enrollment or hosted identity qualification. Existing security test suites independently exercise those controls.

| Command/check | Actual local result |
|---|---|
| `npm run test:readiness` | PASS: 2 migration tests + 32 domain/integration/failure tests |
| `npm run test:browser:readiness` | PASS: visitor → preliminary → synthetic exact-$99 checkout → signed webhook/replay → account binding → intake/acknowledgment → Admin review/findings/outside recommendation → preview/human QA/final → portal report → credit claim/approval/$99 invoice application |
| `npm run test:security:phase1a` | PASS: 77 tests + 22 card configuration/checkout checks |
| `npm run test:security:phase1b` | PASS: 44 tests |
| `npm run test:security:phase1c` | PASS: 61 tests |
| `npm run test:ordinary-transfer` | PASS: 61 tests |
| Landing browser checks | PASS at 375/768/1440px: assets, no overflow, private gut answers, tabs/FAQ, all CTAs, focus/Escape, canonical/Service metadata, no console errors |
| Automated WCAG A/AA | PASS: zero violations on mobile landing and preliminary modal; manual keyboard/focus checks also pass |
| Prisma generation, TypeScript, targeted ESLint, diff whitespace | PASS |
| Production compilation (`npm run build`, isolated test bindings) | PASS; two existing ordinary-storage filesystem-tracing warnings remain |

The 299 automated domain/security/card checks comprise 34 Readiness checks plus 265 existing security/card checks. Browser, accessibility and compile checks are additional. This does not count them as production qualification or as 299 separate canonical acceptance criteria.

Canonical acceptance 05 mapping:

| # | Acceptance | Local result / evidence |
|---|---|---|
| 1–4 | Arena responsive, CTA, private gut check, low-risk preliminary boundary | PASS: landing browser, accessibility, preliminary/CSRF domain tests |
| 5 | Exact $99 checkout | PASS synthetic transport/server validation; actual Stripe resource qualification BLOCKED |
| 6–8 | One assessment/payment; failures never paid; exact acknowledgment | PASS: verified webhook, redirect/cancel/amount/signature failures, replay, final-submit and immutability tests |
| 9–12 | Admin lifecycle, library CRUD, assignments/one-offs, relationships | PASS: scoped domain/API tests and real local Admin/browser flow; owner production grants BLOCKED |
| 13–16 | Immutable snapshots; separate statuses/dispositions; insufficient info; QA gate | PASS: library edits before/after delivery, replacement history, six areas, exact-draft preview and QA/finalization tests |
| 17–20 | Delivery time, deadline clocks, pending claim, once-only qualifying credit, no outside credit | PASS: failed delivery/audit rollback, calendar limits, claim/approval, capped invoice/replay/expiry/tenant/service failures |
| 21–22 | Audit and authorization | PASS: transaction/audit failures, anonymous/viewer/unassigned ADMIN, expired step-up, stale context/security-version and existing security suites |
| 23–27 | No prototype disclosure; metadata; accessibility; console/overflow; safe analytics | PASS local: responsive browser, WCAG checks, analytics allowlist/dedupe tests |
| 28 | Full synthetic lifecycle | PASS through actual local HTTP/browser and ledger, including outside recommendation |
| 29 | Failure-path QA | PASS: webhook/submission replay, cancellation, missing evidence, unreleased/ungranted Vault, failed delivery/audit, expired claim/redemption, inactive resource, unauthorized roles, notice failure/backoff |
| 30 | Production smoke and real integration configuration | BLOCKED: no deployment requested/permitted; hosted provider/security/publication gates remain |

Screenshots: `readiness-375.png`, `readiness-768.png`, `readiness-1440.png`, `client-submitted-375.png`, `admin-preview-1440.png`, `client-report-credit-375.png`, `client-report-rendered-375.png`, `admin-report-rendered-1440.png`. The rendered frame captures and `synthetic-final-report.html` preserve the actual synthetic report; full-page screenshots can omit offscreen sandbox-frame painting. `accessibility.json` records the automated checks. Logs record actual commands/results and the build's pre-existing warnings.

## RED / YELLOW / GREEN launch gates

| Gate | Status | Evidence / precise remaining work |
|---|---|---|
| Canonical policy / scope / local implementation | GREEN locally | Eight Drive authorities read; exact price, acknowledgment, credit deadlines and recommendation rules implemented |
| Payment integrity | GREEN locally / RED production | Synthetic signed processing/replays/failures pass; configured approved Stripe resources and hosted webhook delivery unqualified |
| Permissions / report / credit integrity | GREEN locally / RED production | Fresh scoped controls and tests pass; actual hosted owner/staff/client grants, enrollment, revocation and database qualification unavailable |
| Confidential evidence workflow | GREEN local integration / RED production | Existing Vault and staff-attested secure handoff integrated; ordinary bypass blocked; actual private providers/scanner/keys/backup/retention and TaxSmart handoff not qualified here |
| Notifications / operations | GREEN local behavior / YELLOW hosted operation | Durable outbox, portal notifications, leases/retry pass; approved email sink/production provider, dispatch scheduling, alerting and operator capacity still require hosted configuration/qualification |
| Page / accessibility / analytics | GREEN locally | Responsive/keyboard/automated contrast and safe event checks pass; rich-result and social-card behavior on the actual production URL remains unverified |
| Schema migration / recovery | GREEN local / RED production | Forward/data preservation/replay/rollback pass on SQLite; remote schema diff, trigger support, backup/restore and migration execution BLOCKED |
| GitHub publication | BLOCKED | Recorded HTTP 403; local commits and verified bundle preserve the implementation. Fix repository access before publication |
| Deployment / production smoke | BLOCKED | User instructed no deployment and no real charge. No hosted smoke or real configuration verification is claimed |
| Overall production launch | RED | Keep purchasing disabled; do not promote or call the product COMPLETE |

No independent local code/test item is being left pending because of GitHub 403. The blocked items require actual repository/hosting/provider/security access or an explicitly permitted release operation; they are not disguised local implementation TODOs. Release activation must respect the existing security gate and current user no-deployment instruction.
