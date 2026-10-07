# Hosted qualification database diagnostic

## Observed failure

On 7 October 2026, the saved private-site browser session reached PK. Both synthetic login probes returned 'An unexpected error occurred'. Ready branch deployment 6ac56c0d1e924000082fdfa7 matched qualification/netlify-security commit 1c4db33e0ab53656663c13a374fa945a90d8cc81; protection remained enabled.

Owner authenticated read-only CLI evidence for pk-qualification-security: LoginRateLimit=0, AuditLog=1, LOGIN_FAILED audits=0, Session=0. This confirms no persisted login activity in that database, not the exact failing operation or proof of connectivity. The schema had previously passed 49-table/integrity/foreign-key/fixture checks. Do not reinitialize it.

Metadata-only configuration checks confirmed branch-scoped database credentials and matching preview declarations. Local packaged libSQL modules load; a synthetic blocked-network probe reaches one outbound database request and returns the expected generic failure. That is local evidence, not hosted provider connectivity.

## Surgical observability change

The login's initial persistent rate-limit query now logs an enumerated failure category if it throws an unexpected exception. Known application rate-limit denials are unchanged. Categories distinguish internal configuration, known authorization/schema/transport codes, and unknown failure. The classifier inspects only bounded error/cause chains and maps exact known codes/internal messages to fixed strings. Unknown, cyclic and hostile errors stay generic.

No error object, message, URL, token, SQL, credential, user/client identity or provider metadata is logged or sent to the browser. User-facing failures remain generic. No endpoint, test bypass, environment variable, schema change or broader exception logging is introduced.

## Validation and gate

New diagnostic tests: 10/10. Phase 1A: 79/79 (previously 77); Phase 1B: 44/44; mocked checkout: 22/22. TypeScript and changed-file lint passed. Netlify packaging is checked separately before publication; record its final result in the Drive activity entry. Untouched Vault/transfer/browser suites retain their prior evidence and are not claimed as fresh runs.

The diagnostic must be published only to the isolated qualification branch and built there before another hosted probe. It does not fix the underlying failure or establish database-backed security acceptance. Production remains untouched, main is not merged, and Vault remains closed. Overall gate remains RED until hosted blockers are resolved.
