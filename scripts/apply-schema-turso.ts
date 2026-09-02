import { createClient } from "@libsql/client";
import { readFileSync } from "fs";

// One-off: drop all PK app tables (NOT Bra* tables), then apply full schema.
const APP_TABLES = [
  "ClientMessageRead",
  "ClientMessage",
  "LoginRateLimit",
  "DocumentRequest",
  "Deliverable",
  "Document",
  "VerificationFinding",
  "VerificationResult",
  "InternalNote",
  "FormSubmission",
  "Notification",
  "PasswordResetToken",
  "Payment",
  "Invoice",
  "ClientMember",
  "AuditLog",
  "Session",
  "VerificationRequest",
  "Service",
  "Client",
  "User",
  "InventoryMember",
  "InventoryTransaction",
  "InventoryProduct",
  "InventoryLocation",
];

async function main() {
  const { url, token } = JSON.parse(readFileSync("/tmp/turso-creds.json", "utf8"));
  const c = createClient({ url, authToken: token });

  console.log("Dropping stale PK app tables...");
  for (const t of APP_TABLES) {
    try {
      await c.execute(`DROP TABLE IF EXISTS "${t}"`);
    } catch (err: unknown) {
      console.warn(`drop ${t}:`, (err as Error).message.slice(0, 80));
    }
  }

  const sql = readFileSync("/tmp/schema.sql", "utf8");
  const statements = sql
    .split(";")
    .map((s) =>
      s
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim()
    )
    .filter((s) => s.length > 0);
  console.log("Applying schema:", statements.length, "statements");
  let i = 0;
  for (const s of statements) {
    await c.execute(s);
    i++;
  }
  console.log("Executed", i, "statements");

  const tables = await c.execute(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  );
  console.log("Tables:", tables.rows.map((r) => r.name).join(", "));
  process.exit(0);
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
