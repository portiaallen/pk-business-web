import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

process.env.DATABASE_URL = process.env.DATABASE_URL || "file:./prisma/dev.db";
const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding demo data...");

  const password = "DemoPK2026!";
  const passwordHash = await bcrypt.hash(password, 12);

  // Admin
  const admin = await prisma.user.upsert({
    where: { email: "demo.admin@pk-demo.test" },
    update: {},
    create: {
      email: "demo.admin@pk-demo.test",
      name: "PK Admin",
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  console.log(`✓ Admin: ${admin.email}`);

  // Staff
  const staff = await prisma.user.upsert({
    where: { email: "demo.staff@pk-demo.test" },
    update: {},
    create: {
      email: "demo.staff@pk-demo.test",
      name: "PK Staff",
      passwordHash,
      role: "STAFF",
      status: "ACTIVE",
    },
  });
  console.log(`✓ Staff: ${staff.email}`);

  // Client user
  const clientUser = await prisma.user.upsert({
    where: { email: "demo.client@pk-demo.test" },
    update: {},
    create: {
      email: "demo.client@pk-demo.test",
      name: "Acme Bookkeeping",
      passwordHash,
      role: "CLIENT",
      status: "ACTIVE",
    },
  });
  console.log(`✓ Client user: ${clientUser.email}`);

  // Client (business)
  const client = await prisma.client.upsert({
    where: { id: `client_${clientUser.id}` },
    update: {},
    create: {
      id: `client_${clientUser.id}`,
      name: "Acme Bookkeeping LLC",
      status: "ACTIVE",
      notes: "Demo B2B client for testing",
    },
  });
  console.log(`✓ Client business: ${client.name}`);

  // Client membership
  await prisma.clientMember.upsert({
    where: { clientId_userId: { clientId: client.id, userId: clientUser.id } },
    update: {},
    create: {
      clientId: client.id,
      userId: clientUser.id,
      role: "OWNER",
    },
  });
  console.log(`✓ Client membership created`);

  // Services
  const serviceData = [
    {
      slug: "quickbooks-cleanup",
      name: "QuickBooks Cleanup",
      shortName: "QuickBooks Cleanup",
      description: "Organize existing QuickBooks records and create a cleaner starting point.",
      shortDescription: "Behind on your books? PK helps organize existing QuickBooks records.",
      priceDisplay: "Starting at $250",
      priceCents: 25000,
      sortOrder: 1,
    },
    {
      slug: "tax-ready-bookkeeping",
      name: "Tax-Ready Bookkeeping",
      shortName: "Tax-Ready Bookkeeping",
      description: "Get your business records organized before providing them to your tax professional.",
      shortDescription: "Get your records organized before tax time.",
      priceDisplay: "Starting at $400",
      priceCents: 40000,
      sortOrder: 2,
    },
    {
      slug: "monthly-bookkeeping",
      name: "Monthly Bookkeeping Support",
      shortName: "Monthly Bookkeeping",
      description: "Ongoing bookkeeping support for small businesses.",
      shortDescription: "Stay organized throughout the year.",
      priceDisplay: "Starting at $300/month",
      priceCents: 30000,
      sortOrder: 3,
    },
    {
      slug: "income-verification",
      name: "Income Verification & Documentation",
      shortName: "Income Verification",
      description: "Professional organization of authentic income records.",
      shortDescription: "Organize the income information you already have.",
      priceDisplay: "Consultation-based pricing",
      priceCents: null,
      sortOrder: 4,
    },
  ];

  for (const svc of serviceData) {
    await prisma.service.upsert({
      where: { slug: svc.slug },
      update: svc,
      create: svc,
    });
  }
  console.log(`✓ ${serviceData.length} services seeded`);

  // Sample request
  const qbService = await prisma.service.findUnique({ where: { slug: "quickbooks-cleanup" } });
  if (qbService) {
    const existingRequest = await prisma.verificationRequest.findFirst({
      where: { clientId: client.id, serviceId: qbService.id },
    });
    if (!existingRequest) {
      await prisma.verificationRequest.create({
        data: {
          clientId: client.id,
          serviceId: qbService.id,
          requestType: "QuickBooks Cleanup",
          status: "SUBMITTED",
          clientNotes: "Our QuickBooks file has gotten behind. We need help organizing the last 6 months of transactions.",
          requesterName: clientUser.name,
          requesterEmail: clientUser.email,
          submittedAt: new Date(),
        },
      });
      console.log(`✓ Sample request created`);
    }
  }

  console.log("\n── Demo Accounts ──");
  console.log(`Admin:  demo.admin@pk-demo.test / ${password}`);
  console.log(`Staff:  demo.staff@pk-demo.test / ${password}`);
  console.log(`Client: demo.client@pk-demo.test / ${password}`);
  console.log("\nDone!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
