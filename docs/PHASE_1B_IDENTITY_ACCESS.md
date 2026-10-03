# Phase 1B — Identity & access security

Baseline: `f7271dad749d61329449c1109fb7e0d28176950c` on `feat/pk-would-work-here`.

Scope: Phase 1B only. Local implementation and synthetic validation. No publication, deployment, production data access, production migrations, real client data, or Phase 1C resources.

## Authentication

Existing bcrypt passwords and hashed database sessions remain. ADMIN and STAFF password verification now issues a restricted, five-minute WebAuthn challenge instead of a privileged session. Initial enrollment requires an explicitly authorized, expiring enrollment window. An existing ADMIN role does not authorize enrollment or supply capabilities automatically.

SimpleWebAuthn server/browser 14 validates registration/assertions, exact configured origin, RP ID, expected challenge and required user verification. ES256/RS256 are supported. Attestation is not required; no manufacturer is hardcoded. Platform and roaming authenticators use the same credential model. Multiple credentials are supported. Physical keys are optional, including at launch.

Stored authenticator data: credential ID, public key, signature counter, transports, label, device type, backup flag and timestamps. No private authenticator material is received or stored. Labels should describe devices, never client information. Counter updates use compare-and-swap. Challenges are hashed-ticket bound to user, purpose, security version, password-verification timestamp and, where applicable, session. Consumption is atomic and occurs before cryptographic verification; used or expired challenges cannot be replayed. Stale consumed/expired challenges are cleaned on new challenge creation.

`PK_WEBAUTHN_ORIGIN` must be explicitly set in production and preview. RP ID is its hostname. HTTPS is required except localhost in development/test. This implementation did not configure any deployment environment. Canonical production and isolated preview origins require operator review before release; arbitrary request origins cannot configure the relying party.

## Sessions and step-up

Sessions record PASSWORD/WEBAUTHN assurance, actual password-verification time, MFA-verification time, last authenticated request, active client and security version. Recovery/enrollment preserves the original password-verification timestamp rather than falsely refreshing it.

Defaults: privileged staff 30-minute request inactivity / 12-hour absolute expiry; clients 24-hour request inactivity / existing seven-day absolute expiry. Inactivity means authenticated-request inactivity, not proof of physical user presence. Device screen lock remains necessary. All staff session reads require WEBAUTHN assurance; legacy sessions receive migration version -1 and fail validation.

High-risk security/permission changes, destructive operations, pricing changes and QA/release writes require password and MFA verification within five minutes. Password step-up is rate limited. Client membership administration requires recent password verification; client password step-up does not create staff/MFA authority. `requireSensitiveOperation` is the reusable gate for future filing, legal-hold, bulk-export and emergency operations; no future tax/vault workflows were created.

Security version and account status are checked server-side. Revoke-all, recovery, password reset, offboarding, membership changes and privilege changes invalidate relevant sessions. Concurrent session creation checks expected security version. Logout commits revocation and audit together; a persistence/audit failure returns an error and clears the browser cookie rather than falsely claiming server revocation succeeded.

## Recovery

1. Use another registered authenticator through ordinary password/WebAuthn sign-in.
2. Single-use recovery code: ten independently generated 192-bit codes, displayed once, SHA-256 domain-separated hashes only, atomically consumed, replaceable/revocable. Failed valid-format attempts burn their login challenge. Successful recovery invalidates old device credential registrations, revokes sessions and outstanding challenges, increments security version, and issues enrollment-only authority. No privileged session exists until approved WebAuthn enrollment succeeds.
3. Manual administrative recovery: explicitly granted security capability, recent step-up, different target user, expected security version, approved reason code and affirmative policy-proof confirmation. It invalidates authenticators/recovery codes/sessions, audits the operation and opens a 15-minute enrollment window. Password is still required and normal access still requires new WebAuthn enrollment.

Password reset preserves MFA credentials and invalidates sessions/challenges. Existing password-reset recipient/eligibility policy remains administrator-only; staff/client password-reset expansion is not silently introduced.

Manual identity proof is a human procedure, not something a checkbox can verify. Portia must approve the proof/evidence/approver procedure before operational use. Sole-owner loss of every factor requires a separately approved, audited operator recovery procedure; this app does not provide a universal bypass or self-recovery grant.

## Capabilities, client context and assignments

Existing CLIENT/STAFF/ADMIN identities remain; job personas are expressed through grants rather than duplicate identity systems. No specialized capabilities are inferred from ADMIN or STAFF.

Global capabilities: security, permissions, assignments, audit, pricing, client management and consultations (prospect intake).

Client/engagement-scoped capabilities: confidential access, bookkeeping, tax preparation, QA, filing, payments, legal hold, disposal and bulk export. REQUEST grants name the existing VerificationRequest engagement; future TaxCase integration is not built.

A client-scoped grant is an explicit grant to that client; a request-scoped grant is an explicit grant to that engagement. Assignment metadata alone never supplies a capability. Narrow request grants are preferred for staff. Reassignment and specialized capability grants are separate operations; removing a workflow assignment does not silently broaden or manufacture access. Offboarding removes both.

Access requires active user, current security version, MFA for staff, active client, explicitly selected matching client, and the required scope/capability. Specialized request APIs also require confidential-access permission. Collection queries constrain requests, documents and dashboard counts to authorized grants. Invoice lists and summaries use the selected authorized client. Cross-client collection mutation IDs are checked.

Multiple client memberships fail closed until selection. Single-membership client behavior is preserved. Context changes are server-authorized and audited. Portal users lacking context receive a selection prompt. Staff headers show the chosen client. Unscoped client request creation and membership mutations also bind to the client displayed by the screen, rejecting other-tab context changes. The existing portal team page’s obsolete role-property lookup was corrected because it prevented authorized membership administration. SUPPORT, DATA ENTRY and VIEWER gain no professional authority from their role; authorized representatives use existing CLIENT membership permissions.

Every existing admin API has the shared guard in addition to its business rules. Financial rules, approved service data/prices, payment providers, consultation persistence and release QA/payment requirements are preserved. The old request assignment mutation is routed through the audited identity endpoint; the existing assignment UI uses that endpoint.

## Administrative changes, offboarding and audits

`/api/admin/security` supports grant/revoke, role change, enrollment authorization, manual recovery, assignment and offboarding. No self-grants, self-role changes, self-offboarding or self-manual recovery. Authority is independently checked and rechecked inside the transaction. Expected target version provides optimistic concurrency; changes, audit and revocation commit together. Audit failure rolls back privilege changes.

Offboarding disables the account, audits individual capability and assignment revocations, removes capabilities/memberships, clears workflow assignments, deletes authenticators/recovery codes/challenges, revokes sessions and retains authored business history. Membership creation/change/removal is transactional with affected-user session invalidation and auditing; existing staff accounts cannot be invited into client membership as an authorization shortcut. The previously missing OWNER-only membership-removal check is enforced.

Audit metadata uses controlled actions/reasons, canonical target/scope IDs, previous/new role/grant/version/assignment and assurance. It contains no passwords, session tokens, recovery codes, private keys, document contents or client notes. Credential/challenge/recovery/security events are audited. Existing document-center auditing is not claimed to meet future vault requirements.

Inventory cookies, verifier domains, identities and memberships do not confer PK capabilities. Phase 1A environment/resource isolation remains a release prerequisite; code isolation is not proof of separate deployed databases or accounts.

## Schema and rollout — not executed on production

`prisma/schema.prisma` adds:
- User security version and expiring MFA enrollment authorization.
- Session assurance, password/MFA timestamps, last seen, security version and active client.
- WebAuthnCredential, SecurityChallenge, RecoveryCode and CapabilityGrant.

`prisma/security-migrations/phase1b.sql` is a reviewed incremental SQLite/libSQL migration from the accepted Phase 1A schema. This repository had no Prisma migration history; this file is deliberately not presented as a complete fresh-database migration chain or automatically applied. Fresh synthetic databases are created from the full current schema. Existing deployments need a separately authorized, backed-up migration procedure, maintenance/rollback plan and verification against their actual schema. No schema was changed outside disposable synthetic databases.

Before any release, Portia must identify the initial owner/security administrator and approve each initial capability. A trusted operator must provision that explicitly approved first enrollment window and capability set with an audit record in a controlled transaction; no public bootstrap endpoint or automatic ADMIN grant exists. Owner first-factor/MFA enrollment and safe recovery must be completed before opening staff operations. General administration does not automatically supply QA, filing or unrestricted confidential access. Existing sessions will be invalidated by migration.

## Validation and limitations

See `docs/phase1b/validation.json`, `browser-checks.json`, screenshots, and `changed-files.txt` for exact results and file inventory. Commands:
- `npm run test:security:phase1a`
- `npm run test:security:phase1b`
- `npm run test:browser:phase1b`
- `npm run build`
- `npx tsc --noEmit`

Tests create disposable synthetic databases, disable external transports and remove database artifacts. Browser tests use a virtual Chromium platform authenticator with touch input; no physical key, real charge, external notification or confidential data is needed. Browser tests check security/login, the staff context banner and client request screens at 390/768/1440, client request submission and owner team controls, touch targets, WCAG A/AA checks on the new security content and page errors. Existing lint debt is reported separately; no unrelated cleanup was mixed in.

Actual Samsung Galaxy/Android hardware, Chrome/passkey provider, biometric/PIN prompts, passkey sync/recovery, DeX and roaming hardware are NOT VERIFIED. Device acceptance must separately test enrollment, sign-in, recovery, step-up, touch, keyboard optionality and platform credential restoration. Physical-key purchase is not a prerequisite.

Remaining release/security prerequisites: environment/resource isolation, canonical WebAuthn origins, approved owner bootstrap/capability mappings, approved manual recovery policy, vendor/operational verification, actual device testing and review of this implementation. Local SQLite tests are not proof of deployed libSQL concurrency, migration or operational availability. Existing password-recovery policy does not yet provide general client/staff self-service reset.

Phase 1C remains unimplemented. Existing document storage remains NOT APPROVED AS THE SECURE CLIENT VAULT. Its legacy storage deletion, scanning, quarantine, classification, retention, legal hold, audit coverage and backup/restore are not made secure by these identity controls. Phase 1C must consume these gates, establish isolated private confidential storage, validate quarantine/scanning/release, verify disposal, prove authorized restore and pass the complete vault acceptance suite before any confidential upload expansion ships.

No Phase 2/TaxCase, tax production, tax transmission, or vendor integration was added. NOT DEPLOYED. NOT PUBLISHED. NOT PRODUCTION-VERIFIED.
