import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { globalAccess, type Tx } from "./access";
import { libraryInput, clientRecommendation } from "./policy";
const libraryMutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CREATE"), entry: libraryInput }).strict(),
  z
    .object({
      action: z.literal("UPDATE"),
      id: z.string().min(1).max(64),
      expectedVersion: z.number().int().positive(),
      entry: libraryInput,
    })
    .strict(),
  z
    .object({ action: z.literal("DUPLICATE"), id: z.string().min(1).max(64) })
    .strict(),
  z
    .object({
      action: z.literal("ARCHIVE"),
      id: z.string().min(1).max(64),
      expectedVersion: z.number().int().positive(),
    })
    .strict(),
]);
export async function libraryAudit(
  tx: Tx,
  userId: string,
  id: string,
  action: string,
  version: number,
) {
  await tx.auditLog.create({
    data: {
      actorId: userId,
      action: "ADMIN_ACTION",
      resource: "readiness_library",
      resourceId: id,
      metadata: JSON.stringify({ action, version }),
    },
  });
}
export async function readLibrary(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.slice(0, 100) || "";
  const category = url.searchParams.get("category")?.slice(0, 100);
  const type = url.searchParams.get("type")?.slice(0, 40);
  return prisma.$transaction(async (tx) => {
    const user = await globalAccess(tx, request);
    const entries = await tx.recommendationLibraryEntry.findMany({
      where: {
        ...(query
          ? {
              OR: [
                { title: { contains: query } },
                { category: { contains: query } },
                { providerOrResourceName: { contains: query } },
              ],
            }
          : {}),
        ...(category ? { category } : {}),
        ...(type ? { recommendationType: type } : {}),
        ...(url.searchParams.get("active") === "true"
          ? { active: true, archived: false }
          : {}),
      },
      orderBy: [{ title: "asc" }],
      take: 200,
      include: {
        assignments: {
          select: {
            assessmentId: true,
            sourceVersion: true,
            active: true,
            createdAt: true,
          },
        },
      },
    });
    const grants = await tx.capabilityGrant.findMany({
      where: {
        userId: user.id,
        capability: "readiness_library_write",
        scope: "GLOBAL",
        clientId: "",
      },
    });
    return {
      entries: entries.map((entry) => ({
        ...entry,
        preview: clientRecommendation(
          libraryInput.parse({
            title: entry.title,
            category: entry.category,
            recommendationType: entry.recommendationType,
            providerOrResourceName: entry.providerOrResourceName,
            clientFacingDescription: entry.clientFacingDescription,
            whyOrWhenToUse: entry.whyOrWhenToUse,
            clientNextStep: entry.clientNextStep,
            websiteUrl: entry.websiteUrl,
            phone: entry.phone,
            email: entry.email,
            locationOrServiceArea: entry.locationOrServiceArea,
            internalNotes: entry.internalNotes,
            relationshipClassification: entry.relationshipClassification,
            disclosureText: entry.disclosureText,
            active: entry.active,
            archived: entry.archived,
          }),
        ),
      })),
      canWrite: grants.length > 0,
    };
  });
}
export async function mutateLibrary(request: Request, raw: unknown) {
  const input = libraryMutation.parse(raw);
  return prisma.$transaction(async (tx) => {
    const user = await globalAccess(tx, request, true);
    if (input.action === "CREATE") {
      const entry = await tx.recommendationLibraryEntry.create({
        data: { ...input.entry, createdBy: user.id, updatedBy: user.id },
      });
      await libraryAudit(
        tx,
        user.id,
        entry.id,
        "LIBRARY_ENTRY_CREATED",
        entry.version,
      );
      return { id: entry.id };
    }
    const previous = await tx.recommendationLibraryEntry.findUnique({
      where: { id: input.id },
    });
    if (!previous) throw ApiError.notFound();
    if (input.action === "DUPLICATE") {
      const fields = Object.fromEntries(
        Object.entries(previous).filter(
          ([key]) => !["id", "createdAt", "updatedAt", "version"].includes(key),
        ),
      ) as Omit<typeof previous, "id" | "createdAt" | "updatedAt" | "version">;
      const entry = await tx.recommendationLibraryEntry.create({
        data: {
          ...fields,
          title: `${previous.title.slice(0, 150)} (copy)`,
          active: false,
          archived: false,
          createdBy: user.id,
          updatedBy: user.id,
        },
      });
      await libraryAudit(
        tx,
        user.id,
        entry.id,
        "LIBRARY_ENTRY_DUPLICATED",
        entry.version,
      );
      return { id: entry.id };
    }
    const result = await tx.recommendationLibraryEntry.updateMany({
      where: { id: previous.id, version: input.expectedVersion },
      data: {
        ...(input.action === "ARCHIVE"
          ? { active: false, archived: true }
          : input.entry),
        version: { increment: 1 },
        updatedBy: user.id,
      },
    });
    if (!result.count)
      throw ApiError.conflict(
        "Library entry changed; reload before continuing",
      );
    await libraryAudit(
      tx,
      user.id,
      previous.id,
      input.action === "ARCHIVE"
        ? "LIBRARY_ENTRY_ARCHIVED"
        : "LIBRARY_ENTRY_UPDATED",
      input.expectedVersion + 1,
    );
    return { updated: true };
  });
}
