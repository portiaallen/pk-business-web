import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

const SETUP_SECRET = process.env.SETUP_SECRET?.trim();

export async function POST(request: Request) {
  // Protect with setup secret
  const secret = request.headers.get("x-setup-secret");
  if (!SETUP_SECRET || secret !== SETUP_SECRET) {
    return NextResponse.json({ error: "Invalid setup secret" }, { status: 403 });
  }

  const password = "DemoPK2026!";
  const passwordHash = await hashPassword(password);

  // ─── Create admin user ──────────────────────────────────────────────────
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

  // ─── Create staff user ──────────────────────────────────────────────────
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

  // ─── Create client user + business ──────────────────────────────────────
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

  // Create the client (business) record
  const client = await prisma.client.upsert({
    where: { id: `client_${clientUser.id}` },
    update: {},
    create: {
      id: `client_${clientUser.id}`,
      name: "Acme Bookkeeping LLC",
      status: "ACTIVE",
      notes: "Demo B2B client for testing",
    },
  }).catch(() => {
    // If ID collision, find existing
    return prisma.client.findFirst({ where: { name: "Acme Bookkeeping LLC" } });
  });

  if (client) {
    // Create client membership
    await prisma.clientMember.upsert({
      where: { clientId_userId: { clientId: client.id, userId: clientUser.id } },
      update: {},
      create: {
        clientId: client.id,
        userId: clientUser.id,
        role: "OWNER",
      },
    });
  }

  // ─── Seed services ──────────────────────────────────────────────────────
  const serviceData = [
    {
      slug: "quickbooks-cleanup",
      name: "QuickBooks Cleanup",
      shortName: "QuickBooks Cleanup",
      description: "Organize existing QuickBooks records, review transaction categorization, and create a cleaner starting point.",
      shortDescription: "Behind on your books? PK helps organize existing QuickBooks records and create a cleaner starting point.",
      priceDisplay: "Starting at $250",
      priceCents: 25000,
      sortOrder: 1,
    },
    {
      slug: "tax-ready-bookkeeping",
      name: "Tax-Ready Bookkeeping",
      shortName: "Tax-Ready Bookkeeping",
      description: "Get your business records organized before providing them to your tax professional.",
      shortDescription: "Get your business records organized before providing them to your tax professional.",
      priceDisplay: "Starting at $400",
      priceCents: 40000,
      sortOrder: 2,
    },
    {
      slug: "monthly-bookkeeping",
      name: "Monthly Bookkeeping Support",
      shortName: "Monthly Bookkeeping",
      description: "Ongoing bookkeeping support designed to help small-business owners maintain organized records.",
      shortDescription: "Ongoing bookkeeping support designed to help maintain organized records.",
      priceDisplay: "Starting at $300/month",
      priceCents: 30000,
      sortOrder: 3,
    },
    {
      slug: "income-verification",
      name: "Income Verification & Documentation",
      shortName: "Income Verification",
      description: "Professional organization of authentic income records and supporting financial documentation.",
      shortDescription: "Professional organization of authentic income records and supporting financial documentation.",
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

  return NextResponse.json({
    success: true,
    message: "Demo data seeded successfully",
    accounts: {
      admin: "demo.admin@pk-demo.test",
      staff: "demo.staff@pk-demo.test",
      client: "demo.client@pk-demo.test",
      password: "DemoPK2026!",
    },
  });
}
