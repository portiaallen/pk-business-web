# Card availability correction

Base: approved personality commit `48479b7ceb7fe8a9467d648559a84c017711d4a6`, on `feat/pk-would-work-here`.

## Finding and correction

The original public Pay page already enabled card entry when both trimmed `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` were present. Its missing-configuration branch instead made the blanket statement “Card payments are currently unavailable.” The same two settings are required by the existing portal/payment readiness helper and secure checkout architecture. Neither setting is present in this local runtime. A read-only production Pay-page observation also returned the unavailable message; production credential configuration was not accessible, so its precise missing setting cannot be determined here.

The Pay page now calls the existing `isStripeConfigured()` helper on each request and explicitly presents cards as available, with the existing invoice sign-in link, when that check passes. Otherwise it accurately describes configuration missing in this environment and provides a contact link. Presence is the existing configuration readiness criterion, not verification of credential validity or Stripe connectivity. Existing checkout validates credential format and Stripe responses independently. No keys are exposed and no payment guard is bypassed.

Zelle, Cash App, checkout, webhook, authentication, invoice amounts, business rules, and all approved personality assets/styles are unchanged. No production configuration or deployment was performed.

## Validation

- Production build: passed.
- TypeScript `tsc --noEmit`: passed.
- ESLint on changed Pay page and new regression script: passed.
- Full repository lint: unchanged baseline, 24 errors and 43 warnings; baseline and current logs match exactly.
- `node scripts/test-card-checkout.mjs`: 18 checks passed against actual shared configuration helper and checkout handler, with mocked authentication, database, and Stripe boundaries. Tests cover missing/blank/partial configuration, unauthenticated/cross-client access, invalid keys, draft/settled invoices, exact remaining balance, and rejected Stripe amount/URL/mode/metadata mismatches. No real charges or database writes.
- Production-build browser: four runtime configurations (both settings, neither, key only, webhook only), each at mobile 390px, tablet 768px, desktop 1440px. Correct availability, no horizontal overflow, zero axe WCAG A/AA violations, screenshots inspected.
- Card entry retains anonymous invoice return path; mocked authenticated portal pays exact $80 remaining balance and navigates to an intercepted Stripe checkout URL. No external Stripe request or charge.
- No page errors or unexpected console errors. The real anonymous session endpoint's expected 401 is excluded from unexpected console errors.

These checks validate runtime rendering and existing checkout behavior safely, not production Stripe credential validity. The observed live-site configuration state remains unverified until the authorized production operator confirms both required settings are available to that deployment.
