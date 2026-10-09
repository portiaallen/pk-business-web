import { z } from "zod";
import { onboard, requestOnboardingCode } from "@/lib/readiness/purchase";
import { json, failure, body } from "@/lib/readiness/http";
export async function POST(request: Request) {
  try {
    const value = await body(request, 4096);
    const input = z
      .object({
        action: z.enum(["SEND_CODE", "COMPLETE"]),
        fields: z.unknown().optional(),
      })
      .strict()
      .parse(value);
    if (input.action === "SEND_CODE")
      return json(await requestOnboardingCode(request));
    const result = await onboard(request, input.fields);
    const response = json({
      accountReady: result.accountReady,
      clientId: result.clientId,
      assessmentId: result.assessmentId,
    });
    if (result.cookie) response.headers.set("Set-Cookie", result.cookie);
    return response;
  } catch (error) {
    return failure(error);
  }
}
