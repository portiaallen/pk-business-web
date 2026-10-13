// One-off (idempotent) bootstrap: the sole PK admin could not be granted
// capabilities through the app (the security console requires the actor to
// hold the "security" capability), so the global admin capabilities are
// seeded here in exactly the shape the app's own authorize action writes
// (scope GLOBAL, empty client/request). Client-scoped capabilities are NOT
// granted here: those belong to the admin console after choosing a client.
// Prints what it does, no secrets.
import { createClient } from "@libsql/client";
import { randomBytes } from "crypto";

const url = (process.env.DATABASE_URL ?? "").trim();
const token = (process.env.DATABASE_AUTH_TOKEN ?? "").trim();
if (!url || !token) { console.error("no database credentials in environment"); process.exit(1); }
const live = createClient({ url, authToken: token });

const email = "info@pkservices.business";
const user = await live.execute({ sql: "SELECT id, email, role, status FROM User WHERE email = ?", args: [email] });
if (!user.rows.length) { console.error("account not found, nothing changed"); process.exit(2); }
const userId = user.rows[0].id;
if (user.rows[0].role !== "ADMIN") { console.error("account is not ADMIN, refusing"); process.exit(3); }

const capabilities = [
  "consultations", "client_management", "pricing", "audit",
  "security", "assignments", "permissions",
];
let added = 0;
for (const capability of capabilities) {
  const existing = await live.execute({
    sql: "SELECT id FROM CapabilityGrant WHERE userId = ? AND capability = ? AND scope = 'GLOBAL' AND clientId = '' AND requestId = ''",
    args: [userId, capability],
  });
  if (existing.rows.length) continue;
  await live.execute({
    sql: "INSERT INTO CapabilityGrant (id, userId, capability, scope, clientId, requestId, createdAt) VALUES (?, ?, ?, 'GLOBAL', '', '', ?)",
    args: ["cg_" + randomBytes(12).toString("hex"), userId, capability, new Date().toISOString()],
  });
  console.log("granted:", capability, "(GLOBAL)");
  added++;
}
const all = await live.execute({ sql: "SELECT capability, scope FROM CapabilityGrant WHERE userId = ?", args: [userId] });
console.log(`summary: ${added} grants added, ${all.rows.length} total for ${email}:`, all.rows.map(r => r.capability + "/" + r.scope).join(", "));
