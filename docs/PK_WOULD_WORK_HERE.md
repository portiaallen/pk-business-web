# PK WOULD WORK HERE — CODEX HANDOFF

Branch: `feat/pk-would-work-here` (local; publication blocked)

Base: `d30dc4fe61b61f6d240d952179b428a169dbcc9c` (`main` at checkout).

## Experience

A public presentation overhaul of the existing application. The homepage starts with “Your business is busy. Your books shouldn’t be.” and follows customer situations through service discovery, founder trust, the existing client workflow, and consultation.

Charcoal and deep navy establish the workspace; warm paper and gold soften it; pink is limited to small accents and keyboard focus. An HTML/CSS folder-and-records composition supplies an office-inspired fallback without stock imagery, invented financial figures, or a fabricated human identity. Existing self-hosted Source Sans 3 and Cormorant Garamond fonts are reused. No new production dependencies, external images, animations, or font downloads were added.

Reusable presentation lives in `src/app/pk-public.css`, shared color tokens, `Brand`, `PageHero`, `Section`, service cards, and CTA components. Service-discovery copy is separate from the authoritative service catalog.

## Pages materially changed

- `/`: new hero, customer situations, service presentation, founder trust, process, and consultation CTA.
- `/services`: situation-based service index with original anchor IDs, scopes, starting prices, and disclosures.
- `/about`: factual founder introduction and text-based fallback for the missing portrait; typography and branding alignment.
- `/contact`: welcoming introduction, form panel, next-step context, and sensitive-information guidance. Form implementation unchanged.
- `/pay`: invoice/payment context and shared page shell; removed duplicate header/main/footer; original payment destinations and Stripe enablement condition retained.
- `/portal/login`, including `?admin=1`: presentation and explanatory copy only; authentication behavior unchanged.
- Shared public navigation/footer: brand lockup, active-page indication, 44px menu target, bounded mobile navigation, Escape handling, and skip-to-content link. The shared shell and tokens also provide modest alignment around portal/password-recovery surfaces.

## Protected systems

Diff audit confirms no changes to `src/app/api`, `src/lib`, `prisma`, `src/proxy.ts`, `src/components/auth`, `src/components/forms/ConsultationForm.tsx`, `src/content/services.ts`, `public`, package manifests/lockfile, Next.js configuration, or CI configuration.

Authentication, admin mode, password recovery, role guards, consultation persistence/notifications, invoice/payment logic, document storage, deliverables, database behavior, and business rules remain intact. The sign-in component's pre-render logic and payment configuration checks are retained. Existing metadata/SEO declarations, PWA files, and service IDs/prices/scopes are preserved. No database was seeded, no business records were submitted, and no production credentials or production data were used. Ask PK/LAI and TaxSmart Pro were not modified.

## Asset audit

Tracked public assets contained PWA icons, framework starter SVGs, the service worker, manifest, and offline page. No approved logo, founder/LA-001 portrait, office photography, or custom font assets were present. The About page referenced `/images/portia-allen-founder.jpg`, which was absent.

Existing fonts and PWA assets are retained; existing factual founder content is reused. The missing photo reference is replaced with an intentional founder text panel. The PK text lockup is a presentation fallback, not a replacement portrait or mascot. A supplied approved portrait or logo can be incorporated later; neither is required for this implementation to render correctly.

## Validation

| Check | Result |
| --- | --- |
| Baseline production build | Passed before changes |
| Final `npm run build` | Passed |
| `npx tsc --noEmit` | Passed, including after restoring generated `next-env.d.ts` |
| ESLint on all changed TS/TSX files | Passed |
| Full `npm run lint` | **PRE-EXISTING ISSUE:** 24 errors / 43 warnings; final output identical to baseline |
| `git diff --check` | Passed |
| Protected-path diff audit | Passed; paths listed above unchanged |
| Automated browser checks | 39 passed |
| axe WCAG A/AA checks | Zero violations across eight public entries at mobile and desktop sizes |
| Browser page errors | None |

Browser checks used the production build served locally on port 4321. Routes: `/`, `/services`, `/about`, `/contact`, `/pay`, `/portal/login`, `/portal/login?admin=1`, `/forgot-password`. Layout checks at 320×800, 390×844, 768×1024, and 1440×1000 verified HTTP 200, no horizontal overflow, one h1, and one main landmark. Mobile, tablet, and desktop screenshots were visually inspected, including form, payment, and login surfaces.

Interaction checks cover mobile navigation/Escape, skip-link focus, service anchors, consultation required-field validation and first-error focus, unchanged submitted field names/service IDs, error retention/retry, success/reset, and client/admin login mode/return-route payloads. Consultation and login responses were **mocked**: these checks do not claim live persistence, email delivery, or authenticated account access. Real anonymous requests confirmed portal/admin page redirects and API 401/403 rejection. The payment page was checked in the local unconfigured-card state, with original external payment destination and invoice guidance.

The existing security test script depends on seeded fixture accounts and performs business mutations; the QB review script targets an external environment. Neither was executed under this task's no-seeding/no-production-data constraints. Existing full authenticated integration workflows, mail delivery, and live Stripe checkout were not re-exercised. Their implementation is unchanged.

Accessibility issues introduced during the first design pass (desk graphic role and About CTA contrast) were fixed and the complete browser/a11y checks rerun successfully. No unresolved failure introduced by this overhaul remains in the checks performed.

## Review artifacts

- [Desktop hero](pk-would-work-here/desktop.png)
- [Tablet hero](pk-would-work-here/tablet.png)
- [Mobile hero](pk-would-work-here/mobile.png)
- [Browser check results](pk-would-work-here/browser-results.json)

## Remaining issues

Feature-branch publication is blocked: `git push -u origin feat/pk-would-work-here` returned HTTP 403 (permission denied). The connected GitHub integration also rejected its Git-object write with HTTP 403, “Resource not accessible by integration.” No remote branch was published. The local branch contains two coherent commits and has a clean working tree. A Git bundle is preserved at `/workspace/scratch/pk-would-work-here-final.bundle`. After GitHub write access is available, publish with `git push -u origin feat/pk-would-work-here`.

The existing repository-wide lint backlog remains. See the baseline/final counts above; operational logic was kept outside this public redesign. No new public-layout or accessibility blocker was found. Missing approved portrait/logo assets have functional presentation fallbacks.

## Production

**NOT DEPLOYED TO PRODUCTION.** No main push, deployment command, DNS change, Vercel configuration change, database seed, or production-data modification was performed.
