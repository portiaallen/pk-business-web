import { createClient } from "@libsql/client";
import { readFileSync, writeFileSync } from "fs";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

// One-off: create the real PK admin account in production Turso.
// Credentials from /tmp/turso-creds.json (deleted after use).
// The generated password is written ONLY to /tmp/new-admin-credentials.json
// for the user's first login — never printed to stdout.

async function main() {
  const { url, token } = JSON.parse(readFileSync("/tmp/turso-creds.json", "utf8"));
  const c = createClient({ url, authToken: token });

  const email = "info@pkservices.business";
  const name = "PK Business Services Admin";
  const password = randomBytes(18).toString("base64url"); // ~144 bits
  const passwordHash = await bcrypt.hash(password, 12);
  const id = "user_" + randomBytes(12).toString("hex");

  // Check existing
  const existing = await c.execute({
    sql: "SELECT id, email, role, status FROM User WHERE email = ?",
    args: [email],
  });
  if (existing.rows.length > 0) {
    console.log("ALREADY_EXISTS");
    process.exit(2);
  }

  await c.execute({
    sql: `INSERT INTO User (id, email, name, passwordHash, role, status, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, 'ADMIN', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    args: [id, email, name, passwordHash],
  });

  // Verify
  const check = await c.execute({
    sql: "SELECT id, email, name, role, status FROM User WHERE email = ?",
    args: [email],
  });
  const row = check.rows[0];
  console.log(
    "CREATED:",
    JSON.stringify({ email: row.email, role: row.role, status: row.status })
  );

  // Password written only to temp file for the user's first login
  writeFileSync(
    "/tmp/new-admin-credentials.json",
    JSON.stringify({ email, password }, null, 2)
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
