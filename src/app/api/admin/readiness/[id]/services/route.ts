import { prisma } from "@/lib/prisma";
import { assessmentAccess } from "@/lib/readiness/access";
import { json, failure } from "@/lib/readiness/http";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    return json(
      await prisma.$transaction(async (tx) => {
        await assessmentAccess(
          tx,
          request,
          (await context.params).id,
          "read",
          true,
        );
        return {
          services: await tx.service.findMany({
            where: { status: "ACTIVE", slug: { not: "readiness-assessment" } },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          }),
        };
      }),
    );
  } catch (error) {
    return failure(error);
  }
}
