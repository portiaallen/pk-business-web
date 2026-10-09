import { readLibrary, mutateLibrary } from "@/lib/readiness/library";
import { json, failure, body } from "@/lib/readiness/http";
export async function GET(request: Request) {
  try {
    return json(await readLibrary(request));
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    return json(await mutateLibrary(request, await body(request)));
  } catch (error) {
    return failure(error);
  }
}
