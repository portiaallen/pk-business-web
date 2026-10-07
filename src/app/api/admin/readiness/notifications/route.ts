import { ApiError } from "@/lib/api-error";
import { requireRecentAuthentication } from "@/lib/auth";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { session } from "@/lib/readiness/access";
import { dispatchNotices } from "@/lib/readiness/notifications";
import { json, failure, body } from "@/lib/readiness/http";
export async function POST(request: Request) {
  try {
    z.object({})
      .strict()
      .parse(await body(request));
    await prisma.$transaction(async (tx) => {
      const user = await session(tx, request);
      requireRecentAuthentication(user);
      if (
        user.role === "CLIENT" ||
        user.assurance !== "WEBAUTHN" ||
        !(await tx.capabilityGrant.findFirst({
          where: {
            userId: user.id,
            capability: "security",
            scope: "GLOBAL",
            clientId: "",
          },
        }))
      )
        throw ApiError.forbidden();
    });
    return json(await dispatchNotices());
  } catch (error) {
    return failure(error);
  }
}
