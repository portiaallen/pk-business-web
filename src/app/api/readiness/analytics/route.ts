import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { track } from "@/lib/readiness/analytics";
import { readinessEnabled, limitPublic } from "@/lib/readiness/purchase";
import { json, failure, body } from "@/lib/readiness/http";
const allowed = [
  "readiness_page_view",
  "gut_check_interaction",
  "readiness_cta_click",
  "preliminary_intake_started",
] as const;
export async function POST(request: Request) {
  try {
    const input = z
      .object({ event: z.enum(allowed), dedupeKey: z.uuid() })
      .strict()
      .parse(await body(request, 512));
    if (!readinessEnabled()) return json({ accepted: false });
    await prisma.$transaction(async (tx) => {
      await limitPublic(tx, request, "analytics", 120);
      await track(tx, input.event, input.dedupeKey);
    });
    return json({ accepted: true });
  } catch (error) {
    return failure(error);
  }
}
