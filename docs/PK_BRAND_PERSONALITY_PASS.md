# PK Business Services — Brand Personality Pass

Branch: `feat/pk-would-work-here`

Starting commit: `b5408608d27b4817e2338983d322486162c938a6`.

## Audit and direction

The existing journey, approved hero headline, CTA destinations, service catalog, founder story, and application foundation were retained. The audit found that the hero's illustration, understated gold buttons, repeated dark trust treatment, and missing founder imagery were limiting the brand personality.

The first supplied board informed editorial typography, notebook/folder organization, paper surfaces, annotations, and service discovery. The second supplied image is the canonical visual reference and approved founder asset. It is used directly as `public/images/pk-founder-workspace.jpg` in the hero and About page. SHA-256 matches the supplied original exactly: `65408fb73b6752cafdd1d374d43e98e05471af85f2ca0506f6ee16d30bd73093`. No founder generation, replacement, retouching, stock photography, or external image dependencies were used. The full 16:9 scene preserves the supplied logo and workspace details. Next.js Image provides responsive optimization; the hero image is preloaded and has a reserved aspect ratio.

## Targeted changes

- Black header with warm gold PK typography and meaningful signature-pink consultation actions.
- Approved hero headline in editorial serif type, actual founder/workspace imagery, and concise nonjudgmental reassurance.
- Cream introduction with a black-and-gold notebook, pink ink, checkmarks, and a small italic margin note. Existing customer-situation links remain.
- Approved services presented with folder labels, document lines, gold icons, and controlled pink tabs. Prices, IDs, descriptions, scopes, and disclosures remain authoritative in the unchanged service catalog.
- Founder trust on warm paper, keeping the factual background and principles while adding approachable copy.
- About page now uses the approved founder asset; contact reassurance becomes an intentional pink note.
- Shared paper page heroes lighten Services, About, Contact, and Pay. Login receives a gentle paper/pink background and pink form-panel edge through presentation CSS.
- Subtle service-card lift and button feedback; both disabled under reduced-motion preferences. Existing keyboard behavior and skip link preserved.

Practical information stays in the existing sans-serif font. Editorial moments reuse Cormorant Garamond; no script font or new dependency was added. The composition uses italic margin notes sparingly rather than putting practical content in decorative lettering.

## Protected foundation

Diff audit against the starting commit confirms unchanged APIs, `src/lib`, Prisma/schema, proxy/role guards, authoritative service data, consultation form implementation, authentication provider, portal/admin components, package files, deployment configuration, service worker, and manifest. Pay and login page implementations were not edited during this pass; their visual alignment comes from the shared shell and CSS.

No business records were created, no database was seeded, no production credentials/data were used, and no main merge/push or production deployment was performed. TaxSmart and Ask PK/LAI remain untouched.

## Validation

- Production build: passed.
- TypeScript (`npx tsc --noEmit`): passed, including after restoring generated `next-env.d.ts`.
- ESLint on changed TSX files: passed.
- Full-repository lint: **PRE-EXISTING ISSUE** — 24 errors / 43 warnings; output identical to the original baseline. No lint failure introduced by this pass.
- `git diff --check` and protected-path diff audit: passed.
- 39 automated production-browser checks: passed.
- axe WCAG A/AA checks: zero violations across eight public entries at mobile and desktop sizes.
- Page errors: none across the browser checks. Homepage console/page-error check: clean.
- Reduced motion: verified card hover has `transition-duration: 0s` and no transform.
- Approved founder image: verified loaded at responsive sizes, with reserved layout dimensions.

Routes inspected: homepage, Services, About, Contact, Pay, client login, admin login, and password recovery. Layout checks covered 320×800, 390×844, 768×1024, and 1440×1000: no horizontal overflow, one main landmark, one h1, and successful responses. Mobile, tablet, and desktop screenshots were reviewed against both supplied references.

Existing browser interaction checks were reused: mobile navigation/Escape, keyboard skip focus, service anchors, consultation validation/focus/error retention/retry/success/reset, client/admin login payloads, real anonymous redirects/API rejection, and payment entry. Consultation/login responses are mocked; this does not claim live persistence, email delivery, authenticated account access, or real checkout was re-tested. Those implementations are unchanged. Existing integration scripts that require seeded fixtures or target external environments were not run.

Contrast findings on the warmer cream surfaces and a services-index breakpoint regression were corrected; the complete browser/a11y run subsequently passed. No unresolved public layout/accessibility failure introduced by this pass remains in the checks performed.

## Finished homepage review

- [Desktop](pk-brand-personality/desktop.png)
- [Tablet](pk-brand-personality/tablet.png)
- [Mobile](pk-brand-personality/mobile.png)
- [Automated results](pk-brand-personality/browser-results.json)

These are full-page screenshots of the finished local production build, not mockups.

**NOT DEPLOYED TO PRODUCTION.**
