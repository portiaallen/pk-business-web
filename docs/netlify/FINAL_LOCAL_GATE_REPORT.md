# PK BUSINESS SERVICES — NETLIFY FINAL LOCAL GATE REPORT

## 1. Final classification

**GREEN — READY FOR SEPARATELY AUTHORIZED SYNTHETIC HOSTED NETLIFY VERIFICATION.**

This is readiness for a disposable synthetic qualification environment, **not** production migration, Vault approval or proof of actual Netlify/Cloudflare infrastructure. Both authorized LOCAL application gates are implemented and tested. No production action was taken.

## 2. Commit

Branch: `feat/pk-would-work-here`. Baseline: `bb43bafc3a1a92c2be847e5df77394c93b0b8c32`. The handoff message supplies the exact final local commit SHA; this report is included in that commit. No push, merge or deployment.

## 3. 25 MiB transfer result

Browser -> PK small authorization JSON -> separate HTTPS provider file POST -> private object -> trusted verification callback -> PK confirmation JSON -> ordinary document/deliverable metadata. Application requests are bounded to 8 KiB; a legitimate **26,214,400-byte** body does not traverse the Netlify application function. The actual browser helper, standards-based provider endpoint, remote RPC path and 25 MiB download path passed synthetic local tests. Browser upload checks cover 390/768/1440 widths with interception. Hosted performance, availability and provider enforcement remain unverified.

Detailed receiver/payload table and protocol: [TRANSFER_AND_URL_PRIVACY.md](TRANSFER_AND_URL_PRIVACY.md).

## 4. Ordinary document vs Vault boundary

Ordinary Document/Deliverable records and provider remain distinct from Vault classification, quarantine, scanner, encryption, retention and release APIs. No old files migrated or reclassified. Existing categories do not confer approval for confidential tax/client storage. **Secure Client Vault production uploads remain CLOSED.** Existing Phase 1C tests use disposable synthetic infrastructure only.

## 5. Upload security

Authenticated active session/user; explicit active client or unambiguous permitted membership; active client and engagement; request-scoped capability/grant; strict metadata shape; unpredictable object key; exact MIME/size bound; sanitized display filename; two-minute hashed single-purpose bearer authorization; atomic consumption; trusted object digest/size/type verification; mandatory audit; metadata only after verification. Coarse signatures reject mismatched formats. Browser completion is not trusted. Interrupted/expired uploads remain fail closed and are reconciled. No master storage/service credential enters browser code.

## 6. Download security

Fresh authorization at intent, claim and pre-delivery audit; active session/security version/client/context/grant/document state; one-object expiring grant; integrity verification; audit persisted before bytes; no public/presigned URL; generic download filename; no-store/no-referrer/nosniff/sandbox. Revocation prevents later authorization/delivery; already delivered or in-flight authorized bytes cannot be recalled.

## 7. Delete/revocation security

Applicable role/capability, current assignment/context, recent privileged authentication and hold checks. Access revoked before storage disposal. Idempotent fenced deletion, absence verification, serialized metadata state/tombstone and audit. Failure remains DELETE_PENDING/retryable. Managed or held files cannot bypass disposal through legacy/parent hard deletion. No legal retention periods were invented. Ordinary pending/verified status is exposed for review; Vault disposal foundation remains separate.

## 8. URL trace results

Traced provider transfer/control, R2, reset email, login returnTo/callbacks, WebAuthn, Stripe checkout/returns/webhooks, portal/invoice/document links, host/preview URLs, service worker, logs/audits and browser storage. Transfer credentials are headers, not query parameters; R2 does not generate public/presigned URLs. New reset links use fragments. See the URL lifecycle table in the protocol document for every intended sink and remaining uncertainty.

## 9. Redaction controls

Content-free Node console boundary installed through Next instrumentation; only fixed event names survive. Audit allowlist drops filenames, URLs, tokens, bodies and arbitrary free text. Generic provider exceptions/public errors; unknown actions no longer echo input. Netlify generated wrapper uses route categories rather than full request URLs, refuses client debug-log enablement, and suppresses raw wrapper errors. Local plugin is ordered after the pinned Next adapter and fails a build on unknown wrapper shape. No analytics/error exporter added. Provider-managed ingress/APM logging still requires hosted evidence.

## 10. Redirect/Referer controls

Normalized local portal/admin/b2b/security return paths only; reject external/network paths, controls, backslashes, encoded/double-encoded separators; discard query/fragment. Proxy no longer forwards arbitrary original query to login. Browser rechecks redirects. Stripe requires exact HTTPS checkout host, no credentials/nonstandard port, safe return origin and hosted WebAuthn-origin alignment. Existing global no-referrer retained; cross-origin transfers explicitly omit cookies/referrer and reject redirects. Reset fragments are consumed into memory and removed from visible history. Legacy query reset compatibility cannot retroactively prevent provider ingress logs; inspection/masking is a hosted acceptance requirement.

## 11. Adversarial test results

**61/61 new transfer/privacy tests passed.** Includes authentication/assignment/client inactivity, context and scope denial, ADMIN/SUPPORT/DATA ENTRY boundaries, oversize/type/spoof rejection, expiry, replay, object injection, interrupted upload, false browser completion, stale/revoked sessions/permissions, download audit outage, concurrent claim/confirmation, hold/disposal failure, verified/fenced cleanup, sensitive log/audit/query redaction, malicious return paths, origin confusion, provider-error suppression, actual 25 MiB browser-helper upload and provider download, remote RPC and disposable provider startup. No external production transports or real data.

## 12. Regression results

| Suite | Previous | Current | Result |
|---|---:|---:|---|
| Phase 1A | 77 | 77 | PASS |
| Phase 1B | 44 | 44 | PASS |
| Phase 1C/Vault | 61 | 61 | PASS |
| Mocked checkout | 18 | 22 | PASS; added credential/port/return-origin cases |
| Browser | 58 | 62 | PASS; touch transfer and reset URL cases |
| Netlify artifact | 15 | 15 | PASS |
| Mocked-platform packaged handler | 4 | 4 | PASS |
| Generated-handler privacy | — | 6 | PASS |
| New ordinary transfer/privacy | — | 61 | PASS |

Browser: zero page errors/unexpected console errors; 15 pre-existing Base UI warnings and five expected denial/offline console errors. Virtual Chromium platform authenticator only; actual Android hardware remains unverified. Existing consultation, portal/context, bookkeeping, document/Vault, deliverable/payment gates and recovery regression suites passed; not every historical admin UI action is an end-to-end browser test.

## 13. Build/packaging results

Production `npm run build` (within sanitized local qualification): PASS. Netlify Next adapter 5.16.1 packaging and post-build: PASS. Ordered privacy plugin and artifact/handler/privacy checks: PASS. `npx tsc --noEmit`: PASS. Build has the existing two dynamic-filesystem tracing warnings, not a new failure. Packaging is local; no Netlify API/site/deployment operation occurred.

Reproduce: `npm run test:ordinary-transfer`, existing security/browser scripts, `npm run qualify:netlify:local`, `npx tsc --noEmit`, `node scripts/check-lint-delta.mjs`. No production env files or credentials may be used.

## 14. Full lint classification

**21 pre-existing errors / 40 pre-existing warnings. New errors: 0. New warnings: 0.** Changed-file diagnostics compared against baseline text rather than shifted line numbers. Pre-existing findings in changed pages/controllers are retained. Full lint remains nonzero; it is not falsely reported as clean. Every finding and category is in [LINT_INVENTORY.md](LINT_INVENTORY.md). Security-sensitive/tooling and UI timer/state findings need maintenance review; no demonstrated new Netlify/auth/transfer blocker in executed validation. No unrelated cleanup.

## 15. Vercel compatibility

Vercel configuration preserved; no Vercel SDK replaced. Standard Next Node code and host-neutral provider protocol. Existing Vercel/local ordinary fallback retained when provider absent; approved provider may be used by either host. Vercel context/isolation and existing security regression checks pass locally. Actual Vercel production was not inspected or changed.

## 16. Netlify compatibility

Large-file traffic goes outside application functions. Netlify legacy multipart/large download paths fail closed, never silently fall back. Small authorization/RPC/confirmation routes package successfully. Runtime secrets stay server-side; synthetic mocks cannot be installed into a hosted PK app. Preview setup/Vault remain restricted. Real hosting limits, plugin lifecycle and cache/header behavior still require synthetic hosted qualification.

## 17. Remaining unverified items

Actual Netlify runtime, TLS/CORS/preflights, cookies/origin forwarding, WebAuthn at the temporary hostname, SMTP/test delivery, Stripe test mode/webhook, isolated Turso resource, provider callback latency/availability, 25 MiB provider resource profile and slow/interrupted transfers, live headers/cache/CDN/service worker, provider-managed URL/header/error/APM logs, actual private resource permissions, credit use, rollback and actual Android endpoint behavior. Production private storage/durable fence/cleanup adapters and resource isolation are NOT claimed implemented/proven by the disposable provider. They require their separate production infrastructure scope before any eventual production migration/file activation.

## 18. Hosted qualification requirements (no secret values)

1. Separate Portia authorization before GitHub connection, publishing a qualification branch, site creation, deployment, external TLS exposure or any resource/configuration action.
2. Temporary qualification **branch-deploy/deploy-preview** hostname, for example `<branch>--pk-qualification-<name>.netlify.app`; no PK custom domain/DNS/routing changes. Existing Vercel production stays intact.
3. Qualification source includes this commit; Node 24, pinned Next adapter and ordered local URL-privacy plugin. Automatic production promotion disabled; review deployment access.
4. Use a real Netlify `branch-deploy` or `deploy-preview` context mapped to PK `preview`. A temporary site's root/default deployment is still Netlify `production` and must not be relabeled/spoofed to bypass guards. Preview-only credentials and non-production Turso/libSQL database. Apply reviewed Phase 1A–C and ordinary additive schema artifacts **only to synthetic DB**. No production dump/copy. `PK_ENVIRONMENT=preview` and matching resource declarations.
5. Independent synthetic auth key, synthetic accounts/grants/client contexts and test-only passkeys. Exact HTTPS `PK_WEBAUTHN_ORIGIN`, RP hostname, `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_APP_URL`. Never reuse production passkey credentials.
6. Stripe test keys/webhook secret scoped to preview with approved resource declaration; hosted checkout/signature/webhook regression without real charges.
7. Contained test email sink/account/allowlisted recipient and independently scoped preview email settings; ensure no real recipient/customer notification.
8. Separately hosted disposable **synthetic** provider: approved temporary HTTPS origin, fixed `/transfer` and private `/control`, exact qualification CORS origin, independently generated service credential, PK internal callback. Application `PK_TRANSFER_ORIGIN`, `PK_TRANSFER_SERVICE_SECRET`, `PK_STORAGE_ENVIRONMENT=preview`; no R2/master credentials in browser. The loopback-only reference provider may be used behind a separately approved temporary TLS test bridge; do not expose it under this order. Only synthetic canary files; stop/remove test exposure afterward. Its memory storage is never production infrastructure.
9. If using Cloudflare test resources instead, a reviewed private disposable storage binding/atomic fence must implement `PrivateTransferStorage`; no invented API, prefix-only privacy or public objects. Provisioning/binding is separately authorized. Confirm actual object limits/CORS/TLS and lifecycle/failure behavior.
10. Keep Vault production activation flags unset/closed; do not enable hosted synthetic Vault mocks or hosted setup seed routes. Prepare synthetic DB from trusted offline/local tooling, never a public setup endpoint.
11. Run all local suites plus actual browser (mobile/tablet/desktop), WebAuthn, API auth/CSRF/cross-client, 25 MiB upload/download, provider-state confirmation, interruption/replay/revocation/disposal/holds, cache and failure tests. Actual Android/tablet testing is separate from Chromium emulation.
12. Inspect Netlify/provider logs and spans with harmless canaries in URL query, reset, error, filename, Authorization and transfer metadata. Verify provider debug/headers, log retention/access, no client bytes/tokens. Any unmanaged credential logging is a blocker until remediated.
13. Inspect Netlify credit usage and provider resource use, verify no paid upgrades/billing/resource expansion, document candidate failures and stop conditions. No production cutover approval implied by qualification success.

## 19. Portia actions

Authorize the separately scoped synthetic hosted qualification mission and GitHub/site/test-resource access when ready. Choose the approved temporary synthetic transfer exposure/binding and contained test email recipient; confirm real endpoint/device test availability. No purchase, production credential retrieval or DNS action is required by this LOCAL handoff. Production storage/durable fencing/provider isolation decisions remain separate; do not use the disposable memory service in production.

## 20. Final recommendation

**A. GREEN — READY FOR SEPARATELY AUTHORIZED SYNTHETIC HOSTED NETLIFY VERIFICATION.**

STOP. NOT DEPLOYED. NOT PUBLISHED. NO DNS/PRODUCTION CHANGES. NO MAIN MERGE. NO REAL CLIENT DATA. SECURE CLIENT VAULT PRODUCTION UPLOADS CLOSED.

## Implementation inventory / schema

New `OrdinaryTransferIntent`; additive `ordinaryLegalHold` and `transferDeleteState` fields on Document and Deliverable. Reviewed additive SQL in `prisma/security-migrations/ordinary-transfer.sql`, exercised only against disposable synthetic baseline; no production schema change or migration. Exact changed files:

- `docs/NETLIFY_QUALIFICATION.md`
- `docs/netlify/FINAL_LOCAL_GATE_REPORT.md`
- `docs/netlify/LINT_INVENTORY.md`
- `docs/netlify/TRANSFER_AND_URL_PRIVACY.md`
- `docs/netlify/final-local-validation.json`
- `netlify.toml`
- `netlify/plugins/url-privacy/index.mjs`
- `netlify/plugins/url-privacy/manifest.yml`
- `netlify/plugins/url-privacy/package.json`
- `package.json`
- `prisma/schema.prisma`
- `prisma/security-migrations/ordinary-transfer.sql`
- `scripts/check-lint-delta.mjs`
- `scripts/harden-netlify-artifact.mjs`
- `scripts/qualify-netlify-local.mjs`
- `scripts/synthetic-transfer-server.mts`
- `scripts/test-card-checkout.mjs`
- `scripts/test-netlify-handler.mjs`
- `scripts/test-netlify-privacy.mjs`
- `scripts/test-ordinary-transfer.mts`
- `scripts/verify-phase1b-browser.mts`
- `src/app/admin/documents/page.tsx`
- `src/app/admin/requests/[id]/page.tsx`
- `src/app/api/admin/documents/[id]/route.ts`
- `src/app/api/admin/documents/route.ts`
- `src/app/api/admin/invoices/[id]/actions/route.ts`
- `src/app/api/admin/requests/[id]/ai-assistant/route.ts`
- `src/app/api/admin/requests/[id]/deliverables/[deliverableId]/route.ts`
- `src/app/api/admin/requests/[id]/deliverables/route.ts`
- `src/app/api/admin/requests/[id]/route.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/ordinary-transfer/config/route.ts`
- `src/app/api/ordinary-transfer/confirm/route.ts`
- `src/app/api/ordinary-transfer/internal/route.ts`
- `src/app/api/ordinary-transfer/route.ts`
- `src/app/api/portal/documents/[id]/route.ts`
- `src/app/api/portal/documents/upload/route.ts`
- `src/app/api/portal/invoices/[id]/checkout/route.ts`
- `src/app/api/portal/requests/[id]/deliverables/[deliverableId]/route.ts`
- `src/app/forgot-password/page.tsx`
- `src/app/portal/documents/page.tsx`
- `src/app/portal/invoices/page.tsx`
- `src/app/portal/login/page.tsx`
- `src/app/portal/requests/[id]/page.tsx`
- `src/components/documents/OrdinaryDownload.tsx`
- `src/instrumentation.ts`
- `src/lib/admin-delete.ts`
- `src/lib/api-error.ts`
- `src/lib/auth.ts`
- `src/lib/invoices.ts`
- `src/lib/ordinary-transfer/authority-http.ts`
- `src/lib/ordinary-transfer/client.ts`
- `src/lib/ordinary-transfer/contracts.ts`
- `src/lib/ordinary-transfer/control-endpoint.ts`
- `src/lib/ordinary-transfer/endpoint.ts`
- `src/lib/ordinary-transfer/file-policy.ts`
- `src/lib/ordinary-transfer/json.ts`
- `src/lib/ordinary-transfer/provider.ts`
- `src/lib/ordinary-transfer/service.ts`
- `src/lib/password-reset.ts`
- `src/lib/runtime-log.ts`
- `src/lib/security-log.ts`
- `src/lib/url-privacy.ts`
- `src/proxy.ts`
