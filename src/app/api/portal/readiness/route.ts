import { queue } from "@/lib/readiness/service";
import { json, failure } from "@/lib/readiness/http";
export async function GET(request: Request) {
  try {
    return json(await queue(request));
  } catch (error) {
    return failure(error);
  }
}
