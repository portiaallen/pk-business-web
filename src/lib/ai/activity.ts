import { prisma } from "@/lib/prisma";

/** Record an AI activity event. reviewId may be null only for pre-review errors. */
export async function logAiActivity(
  reviewId: string,
  action: string,
  detail?: string,
  actorType: "AI_GENERATED" | "SYSTEM_GENERATED" | "HUMAN_CREATED" = "SYSTEM_GENERATED",
  actorId?: string | null
) {
  await prisma.aiActivityLog.create({
    data: { reviewId, action, detail: detail ?? null, actorType, actorId: actorId ?? null },
  });
}

export async function getOrCreateAiReview(requestId: string) {
  let review = await prisma.aiReview.findUnique({ where: { requestId } });
  if (!review) {
    review = await prisma.aiReview.create({ data: { requestId, status: "PENDING" } });
  }
  return review;
}
