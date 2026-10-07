import { z } from "zod";
import { beginCheckout } from "@/lib/readiness/purchase";
import { json, failure, body } from "@/lib/readiness/http";
export async function POST(request: Request) {
  try {
    z.object({})
      .strict()
      .parse(await body(request, 1024));
    return json(await beginCheckout(request));
  } catch (error) {
    return failure(error);
  }
}
