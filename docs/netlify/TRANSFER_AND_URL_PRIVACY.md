# Ordinary transfer protocol and URL privacy

Scope: ordinary PK documents/deliverables only. This protocol does not approve ordinary storage for confidential tax/client records, replace Phase 1C, migrate old documents, create production resources, or open the Secure Client Vault.

## Payload/control split

| Receiver | Upload | Download |
|---|---|---|
| PK application / Netlify function | JSON metadata <= 8 KiB; authenticate, authorize, create intent; trusted provider callbacks; confirmation with intent ID only | Authenticated JSON document ID; create/recheck one-operation intent; persist audit before provider delivery |
| Separate transfer provider | Exact bounded file body, up to **26,214,400 bytes (25 MiB)**, fixed `/transfer` POST; scoped ephemeral Authorization header | Fixed `/transfer` POST; reads one private object; integrity check; PK reauthorization/audit; returns file bytes |
| Private storage | Opaque object key, bytes, size, type, SHA-256 digest; immutable write and deletion fence | No public URL; provider-only private read |
| PK database | Hashed bearer grant, user/session/security version, explicit client/engagement, operation, object/intent ID, size/type, expiry, state, digest, minimal document display metadata | Intent state and content-free access audit; no file contents, public URLs or plaintext transfer credential |

The actual browser helper was locally exercised with a 25 MiB `File`: two small PK requests, file body only to the separate provider. Browser touch tests at 390/768/1440 widths intercept the external endpoint and independently check its 25 MiB body and absence of Referer. Download tests exercise the same split with a 25 MiB object. These are LOCAL proofs, not hosted Netlify/Cloudflare performance or logging proof.

## Authorization and lifecycle

A 384-bit random grant is hashed server-side, bound to user, session ID/security version, client, engagement, operation, object, exact size/type, origin and two-minute expiry. Caller-supplied object/client IDs are rejected. User, session assurance, client activity/context, membership or explicit request-scoped capability are re-evaluated at intent, claim, receipt, confirmation and pre-delivery audit. Global ADMIN confers no implicit specialized authority. Staff deliverable upload requires bookkeeping capability. Staff deletion additionally requires ADMIN, disposal authority and recent password/WebAuthn authentication. Ambiguous context fails closed.

`PENDING -> PROCESSING -> STORED -> COMPLETE` (upload); download consumes its grant once and audits before bytes. Compare-and-set transitions prevent replay/double confirmation; mandatory audit failures roll back authorization/metadata and block delivery. Interrupted/error outcomes remain FAILED/pending until reconciliation; expired incomplete uploads are deleted and verified. Fifty active incomplete intents per user is a safety bound, not a complete production abuse-control solution.

The provider enforces exact Origin/CORS, fixed paths, no token query parameters, exact byte bound, MIME allowlist via PK authorization, header consistency and coarse file signatures. ZIP-header checks for Office containers are not complete document parsing. These ordinary checks are **not malware scanning, quarantine or Vault release approval**. Production adapters must apply appropriate deployment resource/time/concurrency limits; the reference endpoint buffers at most one 25 MiB file. Its provider memory/runtime profile remains to be measured in hosted qualification.

`DELETE_PENDING` first revokes document access. Reconciliation serializes final hold checks, idempotent fenced storage deletion, absence verification, tombstone state and audit. A provider/audit failure leaves deletion pending; a freshly authorized session may resume it through a new audited delete intent, superseding stale pending intents; it never becomes verified success. Holds block deletion. There are no invented retention durations or automatic retention permissions. Upload intent display metadata is cleared once the authoritative document record is created. Verified disposal clears residual display metadata and marks originating upload DISPOSED. Managed/held documents cannot be bypassed through legacy deletion or parent hard-delete cascades. Completed intent ledger rows survive metadata cascades. Old ordinary deletion remains legacy behavior for unmanaged records; this is not a retrofit of the Vault disposal system.

## Adapter boundary

The PK-owned `/control` and `/api/ordinary-transfer/internal` protocols use a separate service credential, HTTPS, bounded JSON, generic errors and environment guards. They are NOT claimed to be Cloudflare APIs. `createHTTPAuthority`, `createTransferEndpoint` and `createControlEndpoint` use standard web APIs; vendor/private-storage implementations are injected. Local integration tests exercise the complete RPC path with synthetic storage and mocked HTTP.

`scripts/synthetic-transfer-server.mts` provides a disposable, loopback-only reference service for a **later separately authorized** qualification environment. It requires explicit test/synthetic flags, a `pk-qualification-*` temporary hostname, an independently scoped test credential and a canary in synthetic files; it holds only ephemeral memory with write fences. The canary is a testing convention, not a confidential-data classifier. It is NEVER a production storage/backup solution. Restarted state is lost and accesses fail closed. No public exposure/tunnel/site was created during this mission. Any later TLS exposure is a separately approved qualification action.

Production still requires an independently reviewed private storage adapter (for example Cloudflare R2 bindings), durable cross-instance atomic write/delete fencing or a coordinator, storage environment/credential separation, operational cleanup/retry scheduling, capacity limits, transport configuration and live acceptance. Those resources/adapters are outside this LOCAL application qualification gate. No Cloudflare SDK/API or production resource was fabricated. Vault continues to require its separate approved production infrastructure/security gates.

Netlify never falls back to multipart or legacy large downloads when transfer configuration is absent: those paths fail closed. Vercel/local ordinary legacy behavior is preserved when no transfer provider is configured. Either host can use the same protocol when an approved provider is configured.

## URL lifecycle trace

| URL/token family | Intended destination/storage | Controls and remaining verification |
|---|---|---|
| Transfer | Fixed provider `/transfer`; ephemeral bearer **header**, memory only in browser; PK hash only | No signed query URL, filename/object key/client ID in browser transfer URL; no-referrer, credentials omitted, redirects rejected; provider/app service credential never enters browser; provider ingress/header/APM logging requires hosted inspection |
| Provider `/control` and PK internal RPC | Server-to-server only; opaque object/intent metadata | Auth before bounded body, HTTPS, no redirects, content-free errors; no email/analytics/audit copies of URLs/tokens; external provider log behavior unverified |
| R2 | Existing server-side SDK endpoint/object operations | No presigned/public object URL generated; existing resources/privacy/encryption/credential configuration not verified here; new transfer storage credentials remain server/provider-only |
| Password reset | Approved recipient email gets deliberately expiring single-use link; hash in DB | New token in **fragment**, not request query; browser consumes into memory and removes visible URL; global no-referrer; legacy query links remain accepted for compatibility and cannot be retroactively removed from initial provider ingress logs. Hosted query masking/log retention must be inspected before migration |
| Login returnTo / auth callbacks | Local permitted portal/admin/b2b/security path | Reject external/network paths, backslashes, control characters, repeated/encoded slashes and double encoding; normalize traversal; discard all query/fragment data. Proxy stops propagating original query into login redirect. Browser validates server redirect again |
| WebAuthn | Explicit canonical/qualification HTTPS origin and existing RP configuration | No URL credentials; existing challenge/assurance/security-version controls retained. Hosted transfer and checkout origins must match configured WebAuthn origin. Actual device acceptance remains unknown |
| Stripe checkout | Authenticated browser then exact `https://checkout.stripe.com` | Preserve approved opaque Stripe checkout path; reject credentials/nonstandard port/wrong host/scheme; safe configured return origin, no callback secret. Never log raw provider response or URL. Hosted Stripe test mode/webhook signature/return host requires verification |
| Stripe return/webhook | Configured app origin; invoice opaque ID plus public checkout state; signed webhook header | State is not payment proof; existing verified webhook/payment rules unchanged. No real charge or webhook/provider setting changed |
| Invoice/document notification email | Existing minimized transactional notification | No confidential attachment/document URL/transfer credential; invoice contents remain in portal. Reset email is an intentional auth credential channel, not a document transport |
| Public contact/payment/navigation URLs | Existing public routes and controlled metadata | No client data added; public payment URL remains ordinary public navigation. Preview origins/configuration must be separately scoped; production host/domain unchanged |
| Netlify generated request telemetry | Route category only in controlled wrapper span | Ordered local build plugin replaces full URL `http.target`, disables client-requested debug logging, suppresses raw wrapper exceptions. Unknown adapter wrapper fails build. Six generated-wrapper canary tests. Provider-managed access logs, APM beyond this wrapper, URL/history captured by browsers/extensions/screenshots remain live/policy checks |
| Vercel/platform URLs | Existing host/environment detection, no new deployment URL derivation | Conflicting/unknown contexts remain fail closed. Platform-managed logging is not proven by local source inspection |

No automatic transfer/content destination to AI/Ask PK, email/SMS, Drive/Dropbox, marketing or analytics was introduced. Existing Phase 1A containment remains enforced. The service worker only caches approved static assets/offline shell; API responses and cross-origin POST transfers are not cached. Browser download files remain an endpoint-policy responsibility; in-flight/already delivered bytes cannot be recalled by permission revocation.

## Logging/error redaction

Runtime instrumentation installs a global content-free console boundary for Node application/provider calls: arbitrary strings, exception messages, URLs, filenames, objects and unknown event values are suppressed. Only fixed approved event names survive. Controlled audit metadata drops free text, URLs, tokens, filenames and contents. Typed public errors containing URL/path/credential patterns are generalized; provider failures are explicitly generic. Unrecognized action/decision responses no longer echo arbitrary input. This reduces diagnostic detail intentionally; stage/action audit records and safe event codes support investigation.

No application-level analytics/error-monitoring exporter was added. This is not a claim that upstream managed logs, browser tools, email link scanners, or arbitrary future logging code are safe. Hosted synthetic canaries must verify those surfaces before migration acceptance.
