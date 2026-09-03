import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// Deletes ONLY the security-test fixtures created by seed-security-test.ts and
// the security-tests.sh suite (sectest tenants/users/requests/docs/messages).
// Audit logs are intentionally preserved (no audit deletions, per policy).
// Nothing else is touched — no drops, no broad cleanup, no Bra*/Inventory rows.

process.env.DATABASE_URL = process.env.DATABASE_URL || "file:./prisma/dev.db";
const dbUrl = process.env.DATABASE_URL;
const adapter = dbUrl.startsWith("libsql:")
  ? new PrismaLibSql({
      url: dbUrl,
      authToken: process.env.DATABASE_AUTH_TOKEN?.trim(),
    })
  : new PrismaBetterSqlite3({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

const SECTEST_CLIENTS = ["sectest_client_a", "sectest_client_b"];
const SECTEST_EMAIL_SUFFIX = "@sectest.test";

async function main() {
  const beforeUsers = await prisma.user.count({
    where: { email: { endsWith: SECTEST_EMAIL_SUFFIX } },
  });
  const beforeClients = await prisma.client.count({
    where: { id: { in: SECTEST_CLIENTS } },
  });

  // Sessions / memberships / requests / docs / messages / notes cascade with
  // their owning user/client rows (schema onDelete: Cascade).
  const users = await prisma.user.deleteMany({
    where: { email: { endsWith: SECTEST_EMAIL_SUFFIX } },
  });
  const clients = await prisma.client.deleteMany({
    where: { id: { in: SECTEST_CLIENTS } },
  });
  const rateLimits = await prisma.loginRateLimit.deleteMany({
    where: { email: { endsWith: SECTEST_EMAIL_SUFFIX } },
  });

  const afterUsers = await prisma.user.count({
    where: { email: { endsWith: SECTEST_EMAIL_SUFFIX } },
  });
  const afterClients = await prisma.client.count({
    where: { id: { in: SECTEST_CLIENTS } },
  });

  console.log(
    JSON.stringify({
      usersDeleted: users.count,
      clientsDeleted: clients.count,
      rateLimitRowsDeleted: rateLimits.count,
      remainingSectestUsers: afterUsers,
      remainingSectestClients: afterClients,
      beforeUsers,
      beforeClients,
    })
  );
}

main()
  .catch((e) => {
    console.error("FAIL:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
