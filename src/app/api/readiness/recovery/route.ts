import { z } from "zod";
import { requestRecovery, recoverSetup } from "@/lib/readiness/recovery";
import { body, failure, json } from "@/lib/readiness/http";

export async function POST(request: Request) {
  try {
    const input = z
      .object({
        action: z.enum(["REQUEST", "VERIFY"]),
        fields: z.unknown(),
      })
      .strict()
      .parse(await body(request, 4096));
    if (input.action === "REQUEST")
      return json(await requestRecovery(request, input.fields));
    const result = await recoverSetup(request, input.fields);
    const response = json({ recovered: true });
    response.headers.set("Set-Cookie", result.cookie);
    return response;
  } catch (error) {
    return failure(error);
  }
}
