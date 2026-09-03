import "dotenv/config";
import { createClient } from "@libsql/client";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";

// Secure production onboarding: create a real B2B client tenant + OWNER account.
// Reads Turso credentials from DATABASE_URL / DATABASE_AUTH_TOKEN (preferred)
// or /tmp/turso-creds.json (legacy one-off flow).
//
// SAFETY: this script only INSERTs into User / Client / ClientMember. It never
// drops tables, never touches other tables (including unrelated Bra*/Inventory*
// data), and exits without changes if the email already exists.
//
// The generated password is written ONLY to a 0600 file (default
// /tmp/create-prod-client-credentials.json) — never printed to stdout/logs.
//
// Usage:
//   DATABASE_URL=libsql://... DATABASE_AUTH_TOKEN=... \
//     npx tsx scripts/create-prod-client.ts \
//       --email owner@business.com \
//       --business "Business Name LLC" \
//       [--owner "Owner Full Name"] \
//       [--notes "optional note"] \
//       [--out /tmp/creds.json]

function readArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const email = readArg("--email")?.trim().toLowerCase();
  const business = readArg("--business")?.trim();
  const owner = readArg("--owner")?.trim() || business || "";
  const notes = readArg("--notes")?.trim() || null;
  const outPath = readArg("--out") || "/tmp/create-prod-client-credentials.json";

  if (!email || !business) {
    console.error("USAGE: --email <owner email> --business <business name> [--owner <name>]");
    process.exit(1);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("INVALID_EMAIL");
    process.exit(1);
  }

  // Credentials: prefer env (Settings → Environment), fall back to legacy file.
  const url = process.env.DATABASE_URL?.trim();
  const token = process.env.DATABASE_AUTH_TOKEN?.trim();
  let c;
  if (url && token) {
    c = createClient({ url, authToken: token });
  } else if (existsSync("/tmp/turso-creds.json")) {
    const { url: u, token: t } = JSON.parse(readFileSync("/tmp/turso-creds.json", "utf8"));
    c = createClient({ url: u, authToken: t });
  } else {
    console.error(
      "No credentials: set DATABASE_URL and DATABASE_AUTH_TOKEN (or provide /tmp/turso-creds.json)."
    );
    process.exit(1);
  }

  // Idempotence guard — never duplicate an account.
  const existing = await c.execute({
    sql: "SELECT id, email FROM User WHERE email = ?",
    args: [email],
  });
  if (existing.rows.length > 0) {
    console.log("ALREADY_EXISTS", JSON.stringify({ email: existing.rows[0].email }));
    process.exit(2);
  }

  const password = randomBytes(18).toString("base64url"); // ~144 bits
  const passwordHash = await bcrypt.hash(password, 12);
  const userId = "user_" + randomBytes(12).toString("hex");
  const clientId = "client_" + randomBytes(12).toString("hex");

  await c.execute({
    sql: `INSERT INTO User (id, email, name, passwordHash, role, status, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, 'CLIENT', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    args: [userId, email, owner, passwordHash],
  });
  await c.execute({
    sql: `INSERT INTO Client (id, name, status, notes, createdAt, updatedAt)
          VALUES (?, ?, 'ACTIVE', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    args: [clientId, business, notes],
  });
  await c.execute({
    sql: `INSERT INTO ClientMember (id, clientId, userId, role, createdAt, updatedAt)
          VALUES (?, ?, ?, 'OWNER', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    args: ["cm_" + randomBytes(10).toString("hex"), clientId, userId],
  });

  // Verify what was created (ids only — no secrets in stdout).
  const check = await c.execute({
    sql: `SELECT u.email, u.role, u.status, c.name AS business, cm.role AS memberRole
          FROM User u
          JOIN ClientMember cm ON cm.userId = u.id
          JOIN Client c ON c.id = cm.clientId
          WHERE u.id = ?`,
    args: [userId],
  });
  const row = check.rows[0];
  if (!row) {
    console.error("VERIFY_FAILED");
    process.exit(1);
  }
  console.log(
    "CREATED:",
    JSON.stringify({
      business: row.business,
      email: row.email,
      role: row.role,
      status: row.status,
      memberRole: row.memberRole,
    })
  );

  // Password written only to a 0600 file for the owner's first login.
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify({ email, password }, null, 2), { mode: 0o600 });
  console.log("CREDENTIALS_FILE:", outPath);
  process.exit(0);
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});