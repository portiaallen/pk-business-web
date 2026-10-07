import { reportResponse } from "@/lib/readiness/service";
import { failure } from "@/lib/readiness/http";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    return await reportResponse(
      request,
      (await context.params).id,
      false,
      false,
      new URL(request.url).searchParams.get("reportId") || undefined,
    );
  } catch (error) {
    return failure(error);
  }
}
