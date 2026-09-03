import "dotenv/config";
import { createClient } from "@libsql/client";
import { readFileSync, existsSync } from "fs";

// Targeted, non-destructive helper: change one user's status (ACTIVE/INACTIVE).
// Touches only the User row for the given email — no deletes, no cascades.
//
// Usage:
//   npx tsx scripts/prod-user-status.ts --email <email> --status INACTIVE

function readArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const email = readArg("--email")?.trim().toLowerCase();
  const status = readArg("--status")?.trim().toUpperCase();
  if (!email || (status !== "ACTIVE" && status !== "INACTIVE")) {
    console.error('USAGE: --email <email> --status ACTIVE|INACTIVE');
    process.exit(1);
  }

  const url = process.env.DATABASE_URL?.trim();
  const token = process.env.DATABASE_AUTH_TOKEN?.trim();
  let c;
  if (url && token) {
    c = createClient({ url, authToken: token });
  } else if (existsSync("/tmp/turso-creds.json")) {
    const creds = JSON.parse(readFileSync("/tmp/turso-creds.json", "utf8"));
    c = createClient({ url: creds.url, authToken: creds.token });
  } else {
    console.error("No credentials: set DATABASE_URL and DATABASE_AUTH_TOKEN.");
    process.exit(1);
  }

  const existing = await c.execute({
    sql: "SELECT email, role, status FROM User WHERE email = ?",
    args: [email],
  });
  if (existing.rows.length === 0) {
    console.error("NOT_FOUND");
    process.exit(2);
  }

  await c.execute({
    sql: "UPDATE User SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE email = ?",
    args: [status, email],
  });

  const check = await c.execute({
    sql: "SELECT email, role, status FROM User WHERE email = ?",
    args: [email],
  });
  console.log("UPDATED:", JSON.stringify(check.rows[0]));
  await c.close();
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
