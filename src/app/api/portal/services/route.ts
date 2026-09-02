import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const services = await prisma.service.findMany({
    where: { status: "ACTIVE" },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      shortDescription: true,
      priceDisplay: true,
    },
  });

  return NextResponse.json(services);
}
