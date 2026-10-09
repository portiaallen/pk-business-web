# Readiness remediation #1 — paid setup recovery

8 October 2026. Base: `743aa46c356509651c09dd045a86ec705d28d5b4`. Branch: `recovery/readiness-743aa46`; draft PR #3 remains unmerged. Scope is recovery of an original paid assessment awaiting account setup, plus its migration and tests. No landing redesign, queue/CI remediation, merge, deployment, real charge or production change.

**PASS locally. Hosted production qualification remains BLOCKED.** This resolves the recovery gap from the recovery audit in local synthetic validation; it does not qualify live Stripe/email/database/identity/document providers or enable purchasing.

## Behavior and security

Customers use the recovery form on `/readiness/start` even if their previous setup cookie is absent or expired. They enter the original purchase email, receive a 128-bit random recovery code, and paste it into the form. Credentials never appear in URLs or browser storage. Codes expire in 10 minutes; only an HMAC hash and expiry are stored. The latest requested code supersedes the previous one.

`POST /api/readiness/recovery` accepts `REQUEST` or `VERIFY`, bounded same-origin JSON and strict fields. Request responses and email copy are generic for all valid addresses. The same mail-delivery path is used for known and unknown addresses; no customer name, assessment/client identifier or payment information is sent. This avoids revealing purchase existence before email proof, including a simple send-versus-no-send SMTP timing distinction. Unknown addresses receive an informational message with a code that cannot authorize any assessment. Requests are capped by the existing persistent rate-limit table: 3 sends and 10 verification attempts per normalized email per 15 minutes, plus 10 sends/30 verification attempts per address. Throttled sends also return the generic response. Rejected verification consumes its rate budget in a separate transaction.

A valid code must match the original purchaser email and an unbound, active-client assessment still PAID with its original 9900-cent USD Stripe Payment. The payment's client, invoice and engagement must match the assessment. If multiple legitimately purchased unbound assessments share an email, issuance selects the most recently created eligible assessment; the stored credential is bound to that exact record. Recovery does not infer payment from a redirect or alter the ledger.

Consumption, setup-token rotation and audit evidence occur atomically. The code is cleared, the previous setup cookie is revoked and a new HttpOnly/SameSite cookie grants 15 minutes of setup access. Secure serialization remains enabled under production NODE_ENV. Recovery never issues an authenticated client session, calls checkout, creates an assessment/client/invoice/payment or changes an existing password. Audit failure rolls back consumption and rotation. Account binding clears any outstanding recovery credential.

After recovery, customers continue PK's existing account onboarding above the form. New accounts retain the existing email-code verification and password requirements; existing accounts must sign in with the purchase email. Already-bound customers use the existing portal login; this is not a password-reset mechanism. All assessment/intake/report access still requires normal authentication, membership and client context. When the restored setup window expires, the customer can request recovery again subject to limits, without repurchasing.

Failed email delivery invalidates the unsent code without exposing purchase existence or revoking a valid setup session. Codes, passwords, email addresses and document/report contents are not written to recovery audit metadata. Events are `SETUP_RECOVERY_REQUESTED` and `SETUP_RECOVERY_VERIFIED`, linked to the existing assessment/client and timestamped by the existing AuditLog.

The `readinessEnabled`/`localSyntheticSetupAllowed` production purchasing guard is unchanged. Both recovery actions return 503 in hosted production even with PK_READINESS_ENABLED=true. There is no activation bypass.

## Migration

Schema adds two nullable fields only: `recoveryCodeHash` and `recoveryCodeExpiresAt` on ReadinessAssessment. Existing `readiness-v1.sql` is unchanged; its recorded digest remains valid. Apply `prisma/readiness-migrations/readiness-recovery-v1.sql` after the original Readiness migration, before code that reads these columns. No new account/payment/document tables or independent systems.

The existing local backup/digest/integrity migration runner accepts `--recovery`:

```sh
PK_ENVIRONMENT=test PK_ALLOW_SCHEMA_CHANGE=true node scripts/apply-readiness-local.mjs /absolute/path/to/disposable.db --recovery
```

It requires an existing local database and explicit local authorization, preserves the original guards, takes a backup and records the additional migration digest. Replays verify the digest without reapplying ALTER TABLE. Tests upgrade a pre-recovery paid assessment and verify all original assessment/payment/audit values, ordinary Notification data, six integrity triggers and foreign keys remain unchanged.

Production application is BLOCKED pending the existing approved schema/backup/recovery release process. No production SQL ran. Preserve history on rollback: keep feature access closed, and use only an approved consistent backup if restoration is necessary; do not drop financial/audit history.

## Actual validation

| Check | Result |
|---|---|
| `npm run test:readiness` | PASS: 3 migration + 42 domain/integration/failure tests (45 total) |
| `npm run test:browser:readiness` | PASS: lost-cookie/expired-setup recovery UI, same original assessment/payment, replay denial, existing-account onboarding, full local submission/Admin/report/credit journey |
| `npx tsc --noEmit` | PASS |
| Targeted ESLint on all changed TypeScript/JavaScript | PASS, zero diagnostics |
| `npm run build` | PASS; two inherited ordinary-storage tracing warnings remain |
| `git diff --check` for this remediation | PASS |

Recovery coverage includes unpaid purchase, generic known/unknown response/email, wrong email and code, expiry, supersession, concurrent single consumption, original cookie revocation, restored-cookie expiration, no implicit authenticated session, refunded/mismatched-client ledger, persistent throttling, mail/issuance-persistence failure, audit rollback, bound-account denial and hosted guard preservation. The recovered flow retains exactly one original assessment/payment and makes no additional Stripe checkout call. Existing verified-payment and credit tests also pass.

Domain tests read actual randomly generated codes from the synthetic in-process mail adapter. The browser server has a separate in-process mailbox, so the browser test seeds a known credential hash in its disposable database after exercising the actual request form. That test proves UI/HTTP consumption and continuation, not hosted email delivery. Existing browser staff MFA remains seeded synthetic data. All test data and transports are synthetic; no real charge/email/customer record was used.

Whole-repository lint was not rerun for this narrow change; the prior audit's 21 inherited errors and 39 warnings remain outside scope. The targeted change passes lint. Early development caught a test-helper syntax error and Prisma literal typing issue; both were fixed and checks rerun. Fresh logs and setup screenshot are filed with the Drive remediation evidence rather than overwriting historical implementation screenshots. Next-generated type files and old tracked screenshots were restored after verification.

## Handoff and remaining gates

Fo receives the exact local commit and a single Git mail patch based on 743aa46 in the Drive handoff. Apply only to the recovery branch; verify the base and patch SHA-256, run the focused checks and retain draft PR #3. No merge, deployment, force push, production migration or guard activation is authorized by this change. Canonical policy and earlier implementation/evidence/recovery artifacts are preserved.

Remaining hosted blockers are the previously recorded provider/security/database/identity/email qualification and release gates. Public recovery is deliberately unavailable until those gates are resolved. This result is PASS for remediation #1 locally, not a product launch approval.
