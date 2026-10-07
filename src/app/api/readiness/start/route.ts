import { startPurchase } from "@/lib/readiness/purchase";
import { json, failure, body } from "@/lib/readiness/http";
export async function POST(request: Request) {
  try {
    const result = await startPurchase(request, await body(request, 4096));
    const response = json(
      { assessmentId: result.assessmentId, status: result.status },
      201,
    );
    response.headers.set("Set-Cookie", result.cookie);
    return response;
  } catch (error) {
    return failure(error);
  }
}
