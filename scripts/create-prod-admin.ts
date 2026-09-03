import "dotenv/config";
import { createClient } from "@libsql/client";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

// Secure production admin provisioning.
// - First run: creates info@pkservices.business as ADMIN/ACTIVE.
// - Re-run with --reset: rotates the password of the existing admin account
//   (same email) to a fresh random one. Used when the previous password is
//   unknown/lost. Only the passwordHash column is updated — no other data.
// Credentials from DATABASE_URL / DATABASE_AUTH_TOKEN (preferred) or
// /tmp/turso-creds.json (legacy flow).
// The generated password is written ONLY to the --out file (0600) — never
// printed to stdout/logs.
//
// Usage:
//   npx tsx scripts/create-prod-admin.ts [--reset] [--out /path/to/creds.json]

function readArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const reset = process.argv.includes("--reset");
  const outPath =
    readArg("--out") || "/tmp/new-admin-credentials.json";

  const url = process.env.DATABASE_URL?.trim();
  const token = process.env.DATABASE_AUTH_TOKEN?.trim();
  let c;
  if (url && token) {
    c = createClient({ url, authToken: token });
  } else if (existsSync("/tmp/turso-creds.json")) {
    const creds = JSON.parse(readFileSync("/tmp/turso-creds.json", "utf8"));
    c = createClient({ url: creds.url, authToken: creds.token });
  } else {
    console.error(
      "No credentials: set DATABASE_URL and DATABASE_AUTH_TOKEN (or provide /tmp/turso-creds.json)."
    );
    process.exit(1);
  }

  const email = "info@pkservices.business";
  const name = "PK Business Services Admin";
  const password = randomBytes(18).toString("base64url"); // ~144 bits
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await c.execute({
    sql: "SELECT id, email, role, status FROM User WHERE email = ?",
    args: [email],
  });

  if (existing.rows.length === 0) {
    const id = "user_" + randomBytes(12).toString("hex");
    await c.execute({
      sql: `INSERT INTO User (id, email, name, passwordHash, role, status, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, 'ADMIN', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      args: [id, email, name, passwordHash],
    });
    const check = await c.execute({
      sql: "SELECT email, role, status FROM User WHERE email = ?",
      args: [email],
    });
    console.log("CREATED:", JSON.stringify(check.rows[0]));
  } else if (reset) {
    const row = existing.rows[0];
    if (row.role !== "ADMIN") {
      console.error("REFUSED: account is not an ADMIN");
      process.exit(3);
    }
    await c.execute({
      sql: "UPDATE User SET passwordHash = ?, status = 'ACTIVE', updatedAt = CURRENT_TIMESTAMP WHERE email = ?",
      args: [passwordHash, email],
    });
    console.log("ROTATED:", JSON.stringify({ email, role: row.role, status: "ACTIVE" }));
  } else {
    console.log("ALREADY_EXISTS");
    process.exit(2);
  }

  // Password written only to the requested output file (0600) for first login.
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify({ email, password }, null, 2), {
    mode: 0o600,
  });
  console.log("CREDENTIALS_FILE:", outPath);
  process.exit(0);
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
