// One-off (idempotent): open the MFA enrollment window for the PK admin
// account. Normally an already-signed-in admin does this from the admin
// security console (15-minute window). Portia is the sole admin and could not
// sign in without enrolling first, so the window is opened here with the same
// fields the console sets, for 24 hours. Prints before/after, no secrets.
import { createClient } from "@libsql/client";

const url = (process.env.DATABASE_URL ?? "").trim();
const token = (process.env.DATABASE_AUTH_TOKEN ?? "").trim();
if (!url || !token) { console.error("no database credentials in environment"); process.exit(1); }
const live = createClient({ url, authToken: token });

const email = "info@pkservices.business";
const before = await live.execute({ sql: "SELECT id, email, role, status, mfaEnrollmentAllowed, mfaEnrollmentExpiresAt FROM User WHERE email = ?", args: [email] });
if (!before.rows.length) { console.error("account not found, nothing changed"); process.exit(2); }
console.log("before:", JSON.stringify(before.rows[0]));

// Once the admin has enrolled a passkey, stop reopening the window: the
// console owns enrollment from here on, and every deploy must not re-arm it.
const creds = await live.execute({ sql: "SELECT id FROM WebAuthnCredential WHERE userId = ?", args: [before.rows[0].id] });
if (creds.rows.length) {
  console.log("admin already has " + creds.rows.length + " passkey credential(s), leaving enrollment gate to the console");
  process.exit(0);
}

const row = before.rows[0];
if (row.role === "CLIENT") {
  console.log("role is CLIENT, promoting to ADMIN");
  await live.execute({ sql: "UPDATE User SET role = 'ADMIN', updatedAt = CURRENT_TIMESTAMP WHERE email = ?", args: [email] });
}
const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
await live.execute({
  sql: "UPDATE User SET status = 'ACTIVE', mfaEnrollmentAllowed = 1, mfaEnrollmentExpiresAt = ?, updatedAt = CURRENT_TIMESTAMP WHERE email = ?",
  args: [expiry, email],
});
const after = await live.execute({ sql: "SELECT email, role, status, mfaEnrollmentAllowed, mfaEnrollmentExpiresAt FROM User WHERE email = ?", args: [email] });
console.log("after:", JSON.stringify(after.rows[0]));
console.log("enrollment window open until", expiry);
