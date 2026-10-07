import { detail, adminMutation } from "@/lib/readiness/service";
import { json, failure, body } from "@/lib/readiness/http";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    return json(await detail(request, (await context.params).id, true));
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    return json(
      await adminMutation(
        request,
        (await context.params).id,
        await body(request),
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
