# Phase 1C — Secure Client Vault foundation handoff

Branch: `feat/pk-would-work-here`. Parent: `ba7a0f12db3f8b50201e693090c01291786cba36`.
The Phase 1C commit is the commit containing this document; its exact SHA is provided in the completion response.

**IMPLEMENTED / SYNTHETIC RUNTIME VALIDATED / NOT DEPLOYED / NOT PUBLISHED / NOT PRODUCTION-VERIFIED.**

This is an explicit confidential boundary, independent of the ordinary document center. Production and preview cannot enable it. No production resources, data, credentials, environment variables, or vendor accounts were changed. Phase 2/TaxCase was not started. Only disposable synthetic SQLite/filesystem resources and Chromium virtual platform authenticators were used.

## 1–4. Implementation, files and schema

The implementation adds controlled upload intents; bounded raw uploads; signature/type/extension validation; encrypted quarantine; scanner outcome handling; clean release; an authenticated/audited byte broker; scoped/classification-aware authorization; configurable retention policy metadata; legal holds; verified disposal with independent tombstones; encrypted backup manifests and synthetic restore reconciliation; and a touch-oriented demonstration UI.

Exact files are listed in [phase1c/changed-files.txt](phase1c/changed-files.txt). Validation evidence is in [phase1c/validation.json](phase1c/validation.json), [phase1c/lint-results.json](phase1c/lint-results.json), and [phase1c/browser-checks.json](phase1c/browser-checks.json).

Four new tables:

| Table | Responsibility |
|---|---|
| `VaultDocument` | Opaque ID; canonical client/engagement; controlled purpose/category/classification; upload/scan/release/disposal state; version/lease; digest/size; retention/hold metadata |
| `VaultRetentionPolicy` | Approved, versioned category/trigger and configurable nullable period; initially empty |
| `VaultTombstone` | Minimal durable disposal evidence, independent of client/engagement cascade deletion |
| `VaultBackup` | Manifest ID, client, integrity digest, completion/restoration metadata |

[phase1c.sql](../prisma/security-migrations/phase1c.sql) is an **additive review artifact**, not an automatically deployed migration. It was applied only to disposable synthetic databases. Existing document/security rows are preserved; no existing documents are copied/reclassified. Client/engagement deletion is restricted when Vault records exist so ordinary cascades cannot silently destroy confidential retention/disposal evidence. An approved future decommissioning procedure is needed for those parent records.

## 5–7. Storage, quarantine and scanner

`PrivateStorage` defines segregated quarantine, released, backup and independent disposal-ledger resources. Its interface contains no public/signed URL operation. Existing R2/legacy document configuration is not reused. A resource declaration or a prefix is not evidence of provider isolation.

The executable adapter is **disposable synthetic filesystem storage only**, with separate directories, mode 0700 directories/0600 files, opaque UUID object keys, exclusive immutable content writes, verified read-back, and a disposal fence. Per-key serialization is explicitly single-process test infrastructure; future production adapters must provide durable distributed fencing/conditional writes. Normal application code cannot remove the immutable disposal ledger.

The normal path is:

`INTENT → UPLOADING → PENDING → SCANNING → CLEAN → RELEASING → RELEASED`

Alternate states include `UPLOAD_FAILED`, `SCAN_FAILED`, `REJECTED`, `REQUIRES_REVIEW`, `RECONCILING`, `CANCELLED` and `DISPOSED`. An object existing in released storage is insufficient for download: metadata must also be released, undisposed and authorized. Replay/duplicate upload cannot overwrite bytes. Intent expiry is 15 minutes; operation leases are 10 minutes; pending intents/processing are bounded to 50 per client. Interrupted work requires explicit, step-up-authorized reconciliation; it does not silently become clean. Storage failures preserve an inaccessible visible state.

Initial supported files are PDF, PNG and JPEG, up to 10 MiB. The broker reads a bounded stream, compares declared and actual length, validates byte signatures/trailers against MIME and transient extension, and computes SHA-256. Original filenames are never retained or passed to storage/audit. These signature checks are triage, **not complete structural parsing or malware detection**. A production processor must provide vetted deep validation and malicious-file controls.

`Scanner` is vendor-neutral and returns clean/rejected/requires-review or throws. The synthetic scanner recognizes harmless test markers, outage and review scenarios. Unknown/error results never release a document. Before storage, the synthetic upload path additionally requires the exact fixture marker `PK_SYNTHETIC_VAULT_V1`. This helps prevent accidental uploads; it is **not a DLP classifier or proof that mixed content is non-confidential**. The synthetic-only policy still applies to every operator and test.

No real scanner adapter is installed. Flags cannot enable mock scanning, local storage or ephemeral key authority in production/preview. Production returns a closed/unavailable boundary, not a fabricated clean result.

## 8–9. Authorization and audit

Uses Phase 1B identity, hashed PK session domain, session assurance, idle/absolute expiry, security version, active account/client, explicit client context and existing capability grants. Inventory cookies confer no PK authority. Authentication precedes object lookup to prevent anonymous enumeration; unauthorized/not-found object responses disclose no object metadata.

Every sensitive request binds `x-pk-client-context` to the current server session and verifies that the existing engagement belongs to that active client. STAFF/ADMIN require WebAuthn assurance. Both `confidential_access` and the operation capability are required in CLIENT/REQUEST scope. A workflow assignment or ADMIN label alone confers nothing.

| Operation | Additional capability/control |
|---|---|
| List/view/download | `vault_read` |
| Intent/upload/scan/release/reconciliation | `vault_upload`; reconciliation also recent password + WebAuthn |
| High-risk document | `high_risk_access` in addition to operation permission |
| Tax return information | `tax_information_access` in addition to operation permission |
| Retention/hold change | `legal_hold` + recent password/WebAuthn + optimistic version |
| Disposal | `disposal` + recent password/WebAuthn + retention/hold gate |
| Backup | `bulk_export` + classification permissions + recent password/WebAuthn |
| Restore | `vault_upload` + classification permissions + global `security` + recent password/WebAuthn |

The four added Vault/classification capabilities are administered through the existing Phase 1B permission system; no parallel roles or automatic grants were introduced. **Client membership does not currently grant Vault access.** This foundation's UI is staff-only. A separately approved client/representative permission and delegation policy is required before exposing direct client Vault uploads; TaxSmart/MyTaxOffice remains the preferred handoff meanwhile.

Authorization is re-evaluated inside transactional writes and immediately before mandatory access auditing. Stale permissions, revoked/offboarded sessions and client-context changes fail closed. Audit must commit **before any confidential response bytes are returned**. Decrypted working buffers are cleared after use. Responses are private/no-store, nosniff, no-referrer, and sandboxed with a restrictive CSP. PDF uses generic attachment download; only PNG/JPEG has an in-memory image preview. No confidential original filename appears in disposition.

The existing `AuditLog` stores internally controlled event codes, actor/canonical scope and opaque resource IDs. Events cover upload intent/start/completion/failure, scan start/result, release start/completion, list/view/download, denied access, retention/hold changes, reconciliation, disposal request/pending/completion, backup start/completion, restore start/completion and tombstone skips. No content, original filenames, secret keys, raw tokens, user-entered reasons or signed URLs are included. Audit outages block access and roll back mandatory transitions. A started restore is committed before external writes; failed completion remains distinguishable from a successful restore.

## 10. Retention, hold and disposal

No legal period is populated. Only a matching **approved** policy ID/category/version/trigger permits retention calculation. Disposal eligibility is calculated from that policy's configured period and authorized trigger date. A NULL period leaves eligibility unset and blocks disposal; it is never treated as zero. Trigger dates cannot be future-dated. Human policy approval and lawful trigger verification remain PK responsibilities.

Legal holds use controlled reason codes and opaque references. Version checks serialize hold changes; holds cannot be silently added/removed after disposal starts. No override/bypass endpoint exists.

Disposal commits an access-revoking request and database tombstone, persists/verifies an independent encrypted disposal ledger, deletes quarantine/released/backup document objects, verifies absence in every required zone, then commits completion/evidence. A storage/audit/ledger failure stays pending or otherwise inaccessible and retryable. Completion is never best-effort. Minimal metadata remains; no disposed content is preserved. The independent ledger also fences stale content writes.

## 11–12. Backup, restore and encryption

Backup produces an authenticated encrypted manifest of controlled document metadata, policies/hold state and integrity digests. Document backups are individual encrypted objects, not embedded in immutable manifests, so disposal can delete them. Copies/manifests are read back and verified before completion.

Restore validates envelope and manifest digests, per-document content length/digest, current authority, scope and current metadata. It restores missing metadata/objects, verifies destination bytes, preserves current holds/policies, and checks both database tombstones and the independent encrypted disposal ledger. Ledger entries are carried into recovered state and suppress restoration even when a database tombstone was lost in an older snapshot. Restoration is audited. Synthetic tests restore into new disposable storage resources and verify broker retrieval; an additional test deletes database tombstone evidence and proves that the independent ledger still prevents resurrection.

**This proves the synthetic application protocol, not a production backup.** Authoritative database backup, provider backup access/isolation, key recovery, ledger durability/rollback protection, backup retention, RPO/RTO, complete outage recovery and authorized provider restore exercises remain unverified. Provider redundancy is not called a backup. A production provider must ensure that disposal evidence cannot be rolled back with the database or an old object snapshot.

All document/manifest/ledger bytes use per-object AES-256-GCM envelope encryption with ID-bound authenticated data and wrapped random data keys. Plaintext data keys are not stored in the ordinary database/object names or exposed to browser code/logs. The synthetic wrapping authority uses a random process-only KEK, separate from those stores. It is intentionally **not recoverable across process restart**; no production key export, key provisioning, KMS or vendor decision was made. Future production key authority requires approved key separation, rotation, revocation/recovery and provider access controls. TLS and provider at-rest encryption/private policies must be verified during provider acceptance; their actual deployed configuration is **UNKNOWN**, not assumed from SDK support.

## 13. Ordinary documents and destinations

Existing ordinary storage/document/deliverable routes, payment/pricing rules and service catalog are unchanged. No automatic migration or reclassification occurred. Existing documents remain **NOT APPROVED AS THE SECURE CLIENT VAULT**, including records with legacy tax/banking category labels.

Vault code has no AI, ordinary email/SMS, Drive, Dropbox, ASK PK, marketing or analytics transport. Destination policy permits only the authenticated broker and encrypted Vault backup boundary. Real confidential data is prohibited from development/preview/test. Production activation and any future external scanner/export adapter require explicit security/vendor/data-boundary review. No automatic vendor-ledger/return copying exists.

## 14–19. Validation and browser evidence

Exact commands/results and named checks are in [validation.json](phase1c/validation.json). All data/files/identities are synthetic. No real charge was made.

- Phase 1C: **61/61** real disposable SQLite/storage integration tests.
- Phase 1A: **63/63** containment regressions.
- Phase 1B: **44/44** identity/access regressions, including legacy documents, bookkeeping QA, invoices, deliverables and offboarding.
- Stripe/card: **18/18** mocked configuration/checkout checks; zero real charges.
- Additive migration: **6/6** checks against the accepted Phase 1B schema.
- Browser: **58/58** checks, including actual virtual platform WebAuthn, Vault touch flows at 390/768/1440, existing portal/security/consultation regressions, actual service worker, no file caching/offline retrieval, denied access and canary auditing.
- Production build: **PASS**, with the same two pre-existing ordinary-storage filesystem-tracing warnings.
- TypeScript: **PASS**, `npx tsc --noEmit`.
- Changed-file lint: **0 errors / 0 warnings**; no new diagnostics.
- Full repository lint: **21 pre-existing errors / 40 pre-existing warnings**, unchanged from Phase 1B. Not represented as a clean repository lint run.
- Vault/security content WCAG A/AA automated checks: zero violations at tested widths. Manual screenshot review found no overflow, clipped controls or unreadable/wrapped action labels.
- Browser: zero page errors and zero unexpected console errors. Existing Header/Base UI non-native-button warnings and expected denial/offline network errors are separately counted in browser evidence. Screenshots hide only framework development chrome, not application content/errors.

Screenshots: [mobile](phase1c/vault-390.png), [tablet](phase1c/vault-768.png), [desktop](phase1c/vault-1440.png). Only synthetic document metadata appears. No credentials or file contents are captured.

## 20–23. Limitations, configuration and remaining security gates

1. **Production providers are intentionally absent**, not merely awaiting an environment flag. After Portia selects/approves them, production storage, malicious-file processor/scanner, durable key authority, backup and independent disposal-ledger adapters must be implemented and accepted. No production upload may ship before that acceptance.
2. Provider private access, resource/credential/environment isolation, TLS, at-rest encryption, region/retention/processing contracts, operational monitoring and deployment secret bindings are UNKNOWN/not provisioned. Existing R2 must not be reused by assumption.
3. Synthetic filesystem locks are single-process. Production distributed fencing, job leases/timeouts, bounded concurrency, reconciliation/inventory monitoring and outage/retry behavior need provider-level acceptance. Backup/restore currently performs bounded synthetic work within database transactions; it is not a production worker scheduler.
4. Approved retention registry, lawful trigger/hold procedures, disposal authorization, retention of audit/tombstone evidence and RPO/RTO need PK policy/authority. No legal periods were invented or deployed.
5. Full-database disaster recovery and authorized production restore/key-recovery exercise have not occurred. The tablet is not a backup or authoritative repository.
6. Direct client/representative Vault access is disabled pending approved delegation policy. Client password authentication/ordinary portal workflows remain functional.
7. PDF/PNG/JPEG signature validation is initial triage. Real malicious-file detection, deep structural validation, active-content checks and scanner vendor/data-boundary approval remain required. Mock clean is never production clean.
8. An existing ordinary document center can still hold legacy files; it remains unsuitable for newly approved confidential retention. A separate approved inventory/classification/migration or containment policy is needed; this phase does not claim old files were secured.
9. Actual libSQL/Turso transaction, concurrency and recovery behavior must be verified in authorized isolated provider resources. Local SQLite validation is not production verification.
10. Global edge throttling, alert delivery, incident-response integration and provider outage exercises need operational configuration/review. Code-level audit/event hooks exist; no vendor monitoring service was purchased.
11. Samsung Galaxy device, Android browser/OS passkey behavior, native chooser/camera formats, view/download handling, touch/file sizes, PWA/CacheStorage, session/step-up behavior and optional DeX use remain **NOT HARDWARE-VERIFIED**. No Windows, physical keyboard, mouse, DeX or purchased FIDO2 key is required by the tested essential flows.
12. Pre-existing lint/build/Base UI warning debt remains, as reported separately. This phase makes no unrelated repository cleanup.

## 24. Phase 2 prerequisites / stop

Portia must review this code-validation handoff and separately authorize any next work. Confidential-upload expansion remains release-gated on approved provider/key/scanner/backup integration and operational acceptance, environment isolation, vetted policy/grants, and actual device tests. Phase 1A/1B remain code-validated, not production-verified. Phase 2/TaxCase and production publication/deployment require separate explicit authorization.

**NOT DEPLOYED. NOT PUBLISHED. NOT MERGED TO MAIN. NO PRODUCTION DATA OR RESOURCES MODIFIED.**
