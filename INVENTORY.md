# PK Business Services — Inventory Tracker

Separate product deployed at **https://inventory.pkservices.business**, sharing authentication and database with the main PK Business Services platform.

## Architecture

```
pkservices.business          → Main website + client portal + admin
inventory.pkservices.business → Inventory Tracker (this app)
```

- **Code:** `apps/inventory-tracker/` (Next.js 16)
- **Shared DB:** Same Turso/SQLite database as main app
- **Tenant scope:** `Client.id` (organization)
- **Auth:** Shared `pk_session` cookie (set `COOKIE_DOMAIN=.pkservices.business` in production)

## Local development

```bash
# Terminal 1 — main app
npm run dev

# Terminal 2 — inventory app
npm run dev:inventory
```

Open http://localhost:4322 — you will be redirected to the main portal login if not signed in.

Set in `.env` (both apps read root `.env`):

```env
COOKIE_DOMAIN=          # leave empty locally; use .pkservices.business in prod
NEXT_PUBLIC_MAIN_APP_URL=http://localhost:4321
NEXT_PUBLIC_INVENTORY_URL=http://localhost:4322
```

### Demo data

```bash
npx tsx scripts/seed-inventory-demo.ts
```

Demo login: `demo.inventory@pk-demo.test` / `DemoPK2026!` (local dev only)

## Production deployment (Vercel)

### Direct Vercel link

Create the Inventory Tracker as a **second Vercel project** from the same repo (pre-filled):

**[Deploy Inventory Tracker on Vercel](https://vercel.com/new/import?repository-url=https%3A%2F%2Fgithub.com%2Fportiaallen%2Fpk-business-web&project-name=pk-inventory-tracker&root-directory=apps%2Finventory-tracker&install-command=cd%20..%2F..%20%26%26%20npm%20install%20%26%26%20cd%20apps%2Finventory-tracker%20%26%26%20npm%20install&framework=nextjs)**

After import:

1. Confirm **Root Directory** = `apps/inventory-tracker`
2. Add the environment variables below
3. Add domain `inventory.pkservices.business` under **Settings → Domains**

> **Note:** Merge the `cursor/inventory-tracker-ui-14ed` branch to `main` on GitHub before deploying if that code is not on `main` yet.

### 1. Create a second Vercel project

- **Root directory:** `apps/inventory-tracker`
- **Domain:** `inventory.pkservices.business`

### 2. DNS

Add a CNAME record:

| Type | Name | Value |
|------|------|-------|
| CNAME | inventory | `cname.vercel-dns.com` (or Vercel-provided target) |

### 3. Environment variables (both Vercel projects)

| Variable | Main app | Inventory app |
|----------|----------|---------------|
| `DATABASE_URL` | ✓ | ✓ (same) |
| `DATABASE_AUTH_TOKEN` | ✓ | ✓ (same) |
| `AUTH_SECRET` | ✓ | ✓ (same) |
| `COOKIE_DOMAIN` | `.pkservices.business` | `.pkservices.business` |
| `NEXT_PUBLIC_APP_URL` | `https://www.pkservices.business` | — |
| `NEXT_PUBLIC_MAIN_APP_URL` | — | `https://www.pkservices.business` |
| `NEXT_PUBLIC_INVENTORY_URL` | `https://inventory.pkservices.business` | `https://inventory.pkservices.business` |

### 4. Migrations

Inventory tables are applied automatically via `ensureTursoReady()` on first request (`prisma/turso-migrate-inventory.sql`).

For local SQLite:

```bash
npx prisma db push
```

## Routes

| Route | Purpose |
|-------|---------|
| `/dashboard` | Overview + low stock |
| `/products` | Product list |
| `/products/new` | Add product |
| `/products/[id]` | Detail + stock actions |
| `/locations` | Locations |
| `/transactions` | History |
| `/alerts` | Low-stock alert center |
| `/reports` | Summary + activity + CSV export |

## Portal integration

Client portal nav includes **Inventory** → opens `inventory.pkservices.business` in a new tab. Existing portal routes are unchanged.

## Security

- All queries scoped by `clientId` from authenticated session
- Roles: `OWNER`, `STAFF`, `VIEWER` via `InventoryMember`
- Negative inventory blocked unless `OWNER` override on adjustment
