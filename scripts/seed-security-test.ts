import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";

process.env.DATABASE_URL = process.env.DATABASE_URL || "file:./prisma/dev.db";
const dbUrl = process.env.DATABASE_URL;
const adapter = dbUrl.startsWith("libsql:")
  ? new PrismaLibSql({
      url: dbUrl,
      authToken: process.env.DATABASE_AUTH_TOKEN?.trim(),
    })
  : new PrismaBetterSqlite3({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

const PASSWORD = "TestPK2026!";

type BizSpec = {
  suffix: "a" | "b";
  businessName: string;
};

const businesses: BizSpec[] = [
  { suffix: "a", businessName: "Alpha Test Business LLC" },
  { suffix: "b", businessName: "Beta Test Business Inc" },
];

async function main() {
  console.log("Seeding security-test businesses...");
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  for (const biz of businesses) {
    // Business
    const client = await prisma.client.upsert({
      where: { id: `sectest_client_${biz.suffix}` },
      update: {},
      create: {
        id: `sectest_client_${biz.suffix}`,
        name: biz.businessName,
        status: "ACTIVE",
        notes: "Security test tenant",
      },
    });

    // 4 member roles
    for (const role of ["OWNER", "MANAGER", "STAFF", "VIEWER"] as const) {
      const email = `owner${biz.suffix}@sectest.test`.replace("owner", role.toLowerCase());
      const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          email,
          name: `${biz.businessName} ${role}`,
          passwordHash,
          role: "CLIENT",
          status: "ACTIVE",
        },
      });
      await prisma.clientMember.upsert({
        where: { clientId_userId: { clientId: client.id, userId: user.id } },
        update: { role },
        create: { clientId: client.id, userId: user.id, role },
      });
      console.log(`✓ ${role}: ${email}`);
    }

    // Service
    const service = await prisma.service.findUnique({ where: { slug: "quickbooks-cleanup" } });
    if (!service) throw new Error("Run scripts/seed-demo.ts first");

    // Request per business
    const request = await prisma.verificationRequest.upsert({
      where: { id: `sectest_req_${biz.suffix}` },
      update: {},
      create: {
        id: `sectest_req_${biz.suffix}`,
        clientId: client.id,
        serviceId: service.id,
        requestType: `${biz.businessName} Cleanup`,
        status: "UNDER_REVIEW",
        clientNotes: `Security test request for ${biz.businessName}`,
        requesterName: `${biz.businessName} Owner`,
        requesterEmail: `owner@sectest${biz.suffix}.test`,
        submittedAt: new Date(),
      },
    });

    // Document per business (no file — record only)
    await prisma.document.upsert({
      where: { id: `sectest_doc_${biz.suffix}` },
      update: {},
      create: {
        id: `sectest_doc_${biz.suffix}`,
        requestId: request.id,
        fileName: `confidential-${biz.suffix}.pdf`,
        mimeType: "application/pdf",
        fileSizeBytes: 1234,
        storageKey: `sectest/${biz.suffix}/confidential-${biz.suffix}.pdf`,
        category: "BUSINESS",
        uploadStatus: "UPLOADED",
        reviewStatus: "PENDING",
      },
    });

    // Message per business
    await prisma.clientMessage.upsert({
      where: { id: `sectest_msg_${biz.suffix}` },
      update: {},
      create: {
        id: `sectest_msg_${biz.suffix}`,
        requestId: request.id,
        authorId: (await prisma.clientMember.findFirstOrThrow({
          where: { clientId: client.id, role: "OWNER" },
        })).userId,
        body: `Confidential message for ${biz.businessName}`,
        isFromStaff: false,
      },
    });

    // Internal note (must never be client-visible)
    const adminUser = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    await prisma.internalNote.upsert({
      where: { id: `sectest_note_${biz.suffix}` },
      update: {},
      create: {
        id: `sectest_note_${biz.suffix}`,
        requestId: request.id,
        authorId: adminUser.id,
        content: `INTERNAL ONLY for ${biz.businessName}`,
      },
    });

    // Audit activity
    await prisma.auditLog.create({
      data: {
        actorId: (await prisma.clientMember.findFirstOrThrow({
          where: { clientId: client.id, role: "OWNER" },
        })).userId,
        clientId: client.id,
        action: "ADMIN_ACTION",
        resource: "security_test",
        resourceId: client.id,
        metadata: JSON.stringify({ business: biz.businessName }),
      },
    });

    console.log(`✓ Business ${biz.suffix.toUpperCase()} seeded with request, doc, message, audit`);
  }  // The shared fixture password (TestPK2026!) is intentionally NOT echoed —
  // it is a known, repo-public test credential used only by security fixtures.
  console.log("Done!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
