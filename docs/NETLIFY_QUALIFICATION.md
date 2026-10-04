# Netlify Free qualification preparation

## Decision

**YELLOW — specific remaining engineering and hosted verification required.**

The exact Next.js 16.3.3 application now builds and packages locally with pinned `@netlify/plugin-nextjs` 5.16.1. This is not a deployment, proof of hosted runtime behavior, or permission to migrate. Current Vercel configuration is retained unchanged. All approved Phase 1A–1C controls remain; hosted Vault uploads are CLOSED. No schema changes or production credentials/resources were used.

## Implemented

- `netlify.toml` adds the existing Next/Prisma build, `.next` publishing and pinned adapter. It specifies Node 24 (matching the local Node 24.19.0 qualification) and Functions nodejs24.x and non-secret build-context declarations only. No catch-all SPA redirects, schema push, file-size reduction, live keys or domain changes.
- `security-environment.ts` recognizes Netlify production, deploy-preview, branch-deploy and dev contexts while retaining Vercel checks. Missing/unknown provider context, mismatched PK declaration and conflicting providers fail closed. Local setup and synthetic Vault cannot run on either host even when opt-in flags are present.
- `prisma.ts` requires remote database configuration on hosted environments and rejects hosted file-database fallback. Resource-binding declarations remain necessary, not proof of actual provider isolation.
- Schema utility scripts now reject Netlify markers as well as Vercel and production Node runtime. None were executed against a database.
- `.netlify` build outputs are ignored by Git and lint. Vercel configuration remains in place.
- `qualify-netlify-local.mjs` invokes adapter lifecycle hooks locally, without Netlify CLI/API/account/site/deployment operations. It refuses actual Next `.env` files and discards inherited application/provider credentials. Only system path/home/temp and proxy/CA settings survive; origins are synthetic. It generates local artifacts and a content-free stage report. Generated `next-env.d.ts` is restored after packaging.
- Artifact checks verify compiled proxy route coverage, no-store rules, `/b2b` rewriting and closed qualification state.
- Packaged-handler smoke tests use the actual generated handler with a synthetic Netlify Blobs context and cache misses. Every fetch is intercepted; no provider requests occur. They prove selected unavailable/unauthenticated paths fail closed, not authenticated Netlify operation or cache equivalence.

## Reproduce locally

In a checkout without real `.env` files or client data:

```sh
npm ci
npm run qualify:netlify:local
npm run test:security:phase1a
npm run test:security:phase1b
npm run test:security:phase1c
npm run test:browser:phase1c
npx tsc --noEmit
```

The adapter command modifies ignored `.next`/`.netlify` build output. It does not provision, publish or deploy. The build fetches public Google Fonts; proxy/CA settings may be needed. Do not disable TLS validation to make it pass. Temporary browser test data is synthetic SQLite/files only.

Adapter pinning makes evidence reproducible; upgrades require requalification. Adapter lifecycle-hook simulation is not the full Netlify build service, packaging ZIP/runtime limits or deployed Edge environment. Actual host acceptance remains outstanding.

## Required runtime configuration for a later synthetic candidate

**Not authorized or applied by this change.**

`netlify.toml` environment sections are build declarations. Netlify documentation says file-configured variables are not automatically Functions-scoped runtime secrets. Set runtime values through the approved provider UI/API under separate authorization; never place credentials in TOML/source.

Required non-secret runtime declarations: `PK_ENVIRONMENT`, provider context markers available to runtime, and matching `PK_DATABASE_ENVIRONMENT`, `PK_AUTH_ENVIRONMENT`, `PK_STORAGE_ENVIRONMENT`, `PK_EMAIL_ENVIRONMENT`, `PK_STRIPE_ENVIRONMENT` for the relevant configured integrations. Confirm automatic runtime availability of `NETLIFY`/`CONTEXT`; when host markers are present with missing context the app intentionally denies operation. Do not spoof Vercel fields.

Use synthetic-only, separately scoped database/storage/auth/email/Stripe test resources. Set `PK_WEBAUTHN_ORIGIN`, `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_APP_URL` to the exact synthetic candidate origin; do not allow test links to fall back to the real business domain. Leave synthetic setup/Vault flags OFF on every hosted environment. Do not enable schema scripts during builds.

Deploy-preview/branch-deploy map to PK preview. A temporary site's default **production deployment** maps to PK production even though its dataset is synthetic; it must have dedicated synthetic resources with coherent declarations and never share real production authority. Do not mislabel the host context to work around guards. Prefer an isolated preview/branch candidate under the separately approved deployment procedure. No real production secrets or data are copied.

## Remaining actions before changing YELLOW

### 1. Full-size ordinary file transfer

Ordinary storage permits 25 MiB; Netlify documents 6 MB buffered payloads, effectively about 4.5 MB for binary uploads, and 20 MB streamed responses. Existing portal/admin document/deliverable handlers buffer bytes. The current path cannot preserve the whole allowance on Netlify unchanged. No limit was lowered by this change.

Prepare an explicitly ordinary-document transfer adapter separately from Vault. The proposed approved boundary is:

1. PK session authorization resolves active user/client, assignment/ownership and existing document/engagement permission.
2. Issue opaque, short-lived operation authorization with immutable client/document scope, method, bounded size/type, expiry and replay/idempotency controls. Credentials belong in protected headers, not URLs/logs.
3. Restricted Cloudflare transfer service rechecks the operation and current revocation/security state; it cannot accept arbitrary keys or infer permission from ADMIN/STAFF alone.
4. Stream up to the existing 25 MiB to/from private **ordinary** R2 resources; never expose permanent public URLs, store client data in application filesystem or classify legacy documents as approved Vault objects.
5. PK owns authorized completion/metadata, failure/reconciliation and required audit; interrupted/duplicated operations cannot falsely mark completed. Downloads use safe private/no-store behavior.
6. Test full-size transfer, cross-client IDOR, stale session/assignment, replay, storage/network/audit failures and metadata integrity with synthetic files.

That service/authentication adapter is **not implemented here**. It changes a cross-service trust boundary, not just Netlify TOML. No Cloudflare deployment, resource or DNS change is permitted. Do not claim ordinary 25 MiB workflow readiness until it exists and is proven. Production Vault remains a separate workstream.

### 2. Provider logging and caching

Generated adapter code includes `http.target`/request URL tracing fields. Whether provider instrumentation retains them has not been established. Before real accounts, test harmless reset-token canaries in query strings, headers and errors, with debug headers as well as normal requests. Prevent raw recovery credentials from entering provider logs/traces; do not assume app redaction covers adapter/provider instrumentation.

The default adapter cache expects a Netlify Blobs deployment context even on API paths. The local handler smoke supplies a synthetic context and simulated misses; without it a local handler returns a cache initialization error before the route. This is a local emulation requirement, not evidence that an actual Netlify account is misconfigured. Verify real context, API no-store and cache isolation in a separately authorized synthetic hosted candidate.

### 3. Synthetic hosted qualification and business capacity

No deployment is authorized. Once engineering transfer/logging conditions are addressed, obtain separate permission for a temporary synthetic candidate and test exact Node version/native module bundling, Edge proxy/forwarded origin, WebAuthn, Gmail/Resend, Turso transactions, Stripe raw-body webhook, R2, limits and no-store headers. Preserve existing Vercel production and canonical RP identity until explicitly approved cutover.

Confirm repository ownership/Free Git entitlement, account access and runtime secret scopes. Estimate normal usage against 300 shared credits with safety margin and a response before hard pause. Free commercial eligibility does not provide guaranteed availability. No provider upgrades/purchases are authorized.

## Validation and limitations

Results for this implementation are in `docs/netlify/validation.json`. The full command `npm run qualify:netlify:local` passes the Next production build, the build adapter hooks, 15 artifact checks and four selected packaged-handler checks. Build emitted the same two existing dynamic-filesystem tracing warnings. These deserve review before deployment but were not introduced by host changes.

Phase 1A has 77 passing tests (63 existing plus 14 host-portability cases), with 18 mocked checkout checks; Phase 1B 44 and Phase 1C 61 pass. The existing local browser suite has 58 passing checks at widths 390/768/1440 with virtual platform WebAuthn, no unexpected console errors or page errors; 15 pre-existing Base UI warnings and five expected denial/offline errors are separate. This browser suite runs Next locally, not Netlify Edge/CDN or real Android hardware.

Changed-file lint has no errors or warnings. Full lint remains 21 pre-existing errors and 40 pre-existing warnings; no unrelated cleanup was mixed in. TypeScript passes. No migrations, secret changes, production charges, real email, cloud resources, publication or deployment occurred.

## Next engineering action

Implement and locally adversarially qualify the ordinary 25 MiB transfer boundary, and validate/redact adapter-level URL tracing with synthetic canaries. Then return an explicit synthetic Netlify deployment runbook and readiness decision. Cloud deployment, secrets, DNS, paid services, real data and Vault activation remain separately prohibited unless Portia authorizes them.

Provider references: [Next.js adapter](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/), [Function limits](https://docs.netlify.com/build/functions/configuration/), [environment scopes](https://docs.netlify.com/build/environment-variables/overview/), [current credits](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/). The original audit remains the decision baseline, not evidence of deployed configuration.
