# Existing lint inventory

Baseline: `bb43bafc3a1a92c2be847e5df77394c93b0b8c32`. Full repository: **21 pre-existing errors, 40 pre-existing warnings**. No new errors/warnings in changed files, verified with `node scripts/check-lint-delta.mjs` against baseline source, ignoring moved line numbers. No unrelated debt was fixed.

Security-relevant classifications identify code needing careful review; they are not proof of a vulnerability. The ad-hoc `query-dev-db.cjs` is development tooling and must never be used against production/client data. Unused values in admin controllers do not mean the called authorization guard was skipped. Retain those guards. Hook findings affect existing UI state/timer behavior; they remain regression risks, with no demonstrated new hosting/security/transfer blocker in the executed suites. JSX escaping/navigation findings are unrelated to transfer authorization. The full lint command remains nonzero because of this debt; the production build, type check and changed-file lint delta pass.

- RUNTIME/MIGRATION RELEVANT: 26
- RUNTIME/MIGRATION RELEVANT: 26
- SECURITY RELEVANT: 3
- MAINTAINABILITY ONLY: 30
- STYLE/LOW RISK: 2

| Location | Severity | Rule | Classification |
|---|---|---|---|
| `apps/inventory-tracker/src/components/InventoryShell.tsx:29` | Warning | `@next/next/no-location-assign-relative-destination` | RUNTIME/MIGRATION RELEVANT |
| `query-dev-db.cjs:1` | Error | `@typescript-eslint/no-require-imports` | SECURITY RELEVANT |
| `scripts/generate-pwa-icons.mts:4` | Warning | `@typescript-eslint/no-unused-vars` | MAINTAINABILITY ONLY |
| `src/app/admin/clients/[id]/page.tsx:16` | Warning | `@typescript-eslint/no-unused-vars` | MAINTAINABILITY ONLY |
| `src/app/admin/clients/[id]/page.tsx:140` | Error | `react-hooks/set-state-in-effect` | RUNTIME/MIGRATION RELEVANT |
| `src/app/admin/clients/page.tsx:69` | Error | `react-hooks/set-state-in-effect` | RUNTIME/MIGRATION RELEVANT |
| `src/app/admin/consultations/page.tsx:141` | Error | `react/no-unescaped-entities` | STYLE/LOW RISK |
| `src/app/admin/dashboard/page.tsx:9` | Warning | `@typescript-eslint/no-unused-vars` | MAINTAINABILITY ONLY |
| `src/app/admin/dashboard/page.tsx:10` | Warning | `@typescript-eslint/no-unused-vars` | MAINTAINABILITY ONLY |
| `src/app/admin/dashboard/page.tsx:11` | Warning | `@typescript-eslint/no-unused-vars` | MAINTAINABILITY ONLY |
| `src/app/admin/documents/page.tsx:13` | Warning | `@typescript-eslint/no-unused-vars` | MAINTAINABILITY ONLY |
| `src/app/admin/documents/page.tsx:17` | Warning | `@typescript-eslint/no-unused-vars` | MAINTAINABILITY ONLY |
| `src/app/admin/documents/page.tsx:39` | Warning | `@typescript-eslint/no-unused-vars` | MAINTAINABILITY ONLY |
| `src/app/admin/invoices/[id]/page.tsx:72` | Error | `react-hooks/set-state-in-effect` | RUNTIME/MIGRATION RELEVANT |
| `src/app/admin/invoices/new/page.tsx:8` | Warning | `@typescript-eslint/no-unused-vars` | MAINTAINABILITY ONLY |
| `src/app/admin/invoices/page.tsx:72` | Error | `react-hooks/set-state-in-effect` | RUNTIME/MIGRATION RELEVANT |
| `src/app/admin/layout.tsx:12` | Warning | `@typescript-eslint/no-unused-vars` | MAINTAINABILITY ONLY |
| `src/app/admin/layout.tsx:17` | Warning | `@typescript-eslint/no-unused-vars` | MAINTAINABILITY ONLY |
| `src/app/admin/layout.tsx:64` | Warning | `@next/next/no-location-assign-relative-destination` | RUNTIME/MIGRATION RELEVANT |
| `src/app/admin/layout.tsx:67` | Warning | `@next/next/no-location-assign-relative-destination` | RUNTIME/MIGRATION RELEVANT |
| `src/app/admin/layout.tsx:70` | Warning | `@next/next/no-location-assign-relative-destination` | RUNTIME/MIGRATION RELEVANT |
| `src/app/admin/layout.tsx:80` | Warning | `@next/next/no-location-assign-relative-destination` | RUNTIME/MIGRATION RELEVANT |
| `src/app/admin/requests/[id]/ai-assistant/page.tsx:212` | Error | `react-hooks/set-state-in-effect` | RUNTIME/MIGRATION RELEVANT |
| `src/app/admin/requests/[id]/ai-assistant/page.tsx:342` | Error | `react/no-unescaped-entities` | STYLE/LOW RISK |
| `src/app/admin/requests/[id]/page.tsx:7` | Warning | `@typescript-eslint/no-unused-vars` | MAINTAINABILITY ONLY |
| `src/app/admin/requests/[id]/page.tsx:7` | Warning | `@typescript-eslint/no-unused-vars` | MAINTAINABILITY ONLY |
| `src/app/admin/requests/[id]/page.tsx:9` | Warning | `@typescript-eslint/no-unused-vars` | MAINTAINABILITY ONLY |
| `src/app/admin/requests/[id]/page.tsx:96` | Error | `react-hooks/immutability` | RUNTIME/MIGRATION RELEVANT |
| `src/app/admin/requests/[id]/page.tsx:97` | Error | `react-hooks/immutability` | RUNTIME/MIGRATION RELEVANT |
| `src/app/admin/requests/[id]/page.tsx:98` | Error | `react-hooks/immutability` | RUNTIME/MIGRATION RELEVANT |
| `src/app/admin/requests/[id]/page.tsx:103` | Error | `react-hooks/set-state-in-effect` | RUNTIME/MIGRATION RELEVANT |
| `src/app/admin/requests/[id]/page.tsx:124` | Error | `react-hooks/immutability` | RUNTIME/MIGRATION RELEVANT |
| `src/app/admin/requests/[id]/page.tsx:359` | Warning | `@next/next/no-location-assign-relative-destination` | RUNTIME/MIGRATION RELEVANT |
| `src/app/admin/requests/[id]/page.tsx:731` | Error | `react-hooks/immutability` | RUNTIME/MIGRATION RELEVANT |
| `src/app/admin/requests/[id]/page.tsx:736` | Error | `react-hooks/immutability` | RUNTIME/MIGRATION RELEVANT |
| `src/app/admin/requests/[id]/page.tsx:752` | Error | `react-hooks/purity` | RUNTIME/MIGRATION RELEVANT |
| `src/app/admin/requests/[id]/qb-review/page.tsx:159` | Error | `react-hooks/set-state-in-effect` | RUNTIME/MIGRATION RELEVANT |
| `src/app/admin/requests/[id]/qb-review/page.tsx:159` | Warning | `unused-disable` | MAINTAINABILITY ONLY |
| `src/app/admin/requests/[id]/qb-review/page.tsx:159` | Warning | `react-hooks/exhaustive-deps` | RUNTIME/MIGRATION RELEVANT |
| `src/app/admin/requests/[id]/qb-review/page.tsx:457` | Warning | `@typescript-eslint/no-unused-vars` | MAINTAINABILITY ONLY |
| `src/app/admin/requests/[id]/qb-review/page.tsx:458` | Warning | `@typescript-eslint/no-unused-vars` | MAINTAINABILITY ONLY |
| `src/app/admin/services/page.tsx:37` | Error | `react-hooks/set-state-in-effect` | RUNTIME/MIGRATION RELEVANT |
| `src/app/admin/team/page.tsx:11` | Warning | `@typescript-eslint/no-unused-vars` | MAINTAINABILITY ONLY |
| `src/app/admin/team/page.tsx:18` | Warning | `@typescript-eslint/no-unused-vars` | MAINTAINABILITY ONLY |
| `src/app/api/admin/invoices/[id]/actions/route.ts:12` | Warning | `@typescript-eslint/no-unused-vars` | MAINTAINABILITY ONLY |
| `src/app/api/admin/invoices/[id]/route.ts:19` | Warning | `@typescript-eslint/no-unused-vars` | MAINTAINABILITY ONLY |
| `src/app/api/admin/requests/[id]/qb-review/route.ts:372` | Warning | `@typescript-eslint/no-unused-vars` | SECURITY RELEVANT |
| `src/app/api/admin/team/route.ts:61` | Warning | `@typescript-eslint/no-unused-vars` | SECURITY RELEVANT |
| `src/app/api/health/route.ts:16` | Warning | `@typescript-eslint/no-unused-vars` | MAINTAINABILITY ONLY |
| `src/app/portal/dashboard/page.tsx:10` | Warning | `@typescript-eslint/no-unused-vars` | MAINTAINABILITY ONLY |
| `src/app/portal/dashboard/page.tsx:11` | Warning | `@typescript-eslint/no-unused-vars` | MAINTAINABILITY ONLY |
| `src/app/portal/dashboard/page.tsx:12` | Warning | `@typescript-eslint/no-unused-vars` | MAINTAINABILITY ONLY |
| `src/app/portal/payments/page.tsx:5` | Warning | `@typescript-eslint/no-unused-vars` | MAINTAINABILITY ONLY |
| `src/app/portal/requests/[id]/page.tsx:10` | Warning | `@typescript-eslint/no-unused-vars` | MAINTAINABILITY ONLY |
| `src/app/portal/requests/[id]/page.tsx:16` | Warning | `@typescript-eslint/no-unused-vars` | MAINTAINABILITY ONLY |
| `src/app/portal/team/page.tsx:37` | Error | `react-hooks/set-state-in-effect` | RUNTIME/MIGRATION RELEVANT |
| `src/components/AdminInstallPrompt.tsx:27` | Error | `react-hooks/set-state-in-effect` | RUNTIME/MIGRATION RELEVANT |
| `src/components/admin/InvoiceForm.tsx:39` | Warning | `@typescript-eslint/no-unused-vars` | MAINTAINABILITY ONLY |
| `src/components/admin/InvoiceForm.tsx:39` | Warning | `@typescript-eslint/no-unused-vars` | MAINTAINABILITY ONLY |
| `src/components/auth/AuthProvider.tsx:74` | Warning | `@next/next/no-location-assign-relative-destination` | RUNTIME/MIGRATION RELEVANT |
| `src/components/auth/AuthProvider.tsx:78` | Error | `react-hooks/set-state-in-effect` | RUNTIME/MIGRATION RELEVANT |
