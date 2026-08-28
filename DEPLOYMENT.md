# Deploying to Vercel (Portal & Admin)

The public website works without a database. The **client portal** and **admin dashboard** require a hosted database because Vercel serverless functions cannot use local SQLite files.

## Recommended: Turso (free tier)

Turso uses libSQL, which is compatible with the current Prisma SQLite schema.

### 1. Create a Turso database

1. Sign up at [turso.tech](https://turso.tech)
2. Install the CLI: `curl -sSfL https://get.tur.so/install.sh | bash`
3. Log in: `turso auth login`
4. Create a database:
   ```bash
   turso db create pk-business-services
   ```
5. Get the URL and token:
   ```bash
   turso db show pk-business-services --url
   turso db tokens create pk-business-services
   ```

### 2. Add Vercel environment variables

In **Vercel → Project → Settings → Environment Variables**, add:

| Variable | Example |
|----------|---------|
| `DATABASE_URL` | `libsql://pk-business-services-yourorg.turso.io` |
| `DATABASE_AUTH_TOKEN` | Turso token from step 1 |
| `AUTH_SECRET` | Run `openssl rand -base64 32` |
| `SETUP_SECRET` | Run `openssl rand -base64 32` (for one-time seeding) |

Redeploy after saving variables. The build runs `prisma db push` automatically when `DATABASE_URL` starts with `libsql://`.

### 3. Seed demo accounts (one time)

After the first successful deploy with Turso configured:

```bash
curl -X POST "https://YOUR-VERCEL-URL.vercel.app/api/setup/seed" \
  -H "x-setup-secret: YOUR_SETUP_SECRET"
```

### 4. Verify

- Health check: `GET /api/health` should return `{ "status": "ok", "database": "connected" }`
- Admin login: `/admin/login` with `demo.admin@pk-demo.test` / `DemoPK2026!`

## Demo accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | `demo.admin@pk-demo.test` | `DemoPK2026!` |
| Staff | `demo.staff@pk-demo.test` | `DemoPK2026!` |
| Client | `demo.client@pk-demo.test` | `DemoPK2026!` |

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "An unexpected error occurred" on login | SQLite on Vercel or missing DB | Set Turso env vars and redeploy |
| "Database is not configured" | `DATABASE_URL` missing | Add Turso variables in Vercel |
| Login returns 401 | Database not seeded | Run `/api/setup/seed` |
| Health returns `connection_failed` | Wrong token or schema not pushed | Check `DATABASE_AUTH_TOKEN`; redeploy to run `db push` |
