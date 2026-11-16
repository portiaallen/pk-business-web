import { z } from "zod";
import {
  confirmPurchase,
  publicStatus,
  availability,
  purchaseToken,
} from "@/lib/readiness/purchase";
import { body, json, failure } from "@/lib/readiness/http";
export async function GET(request: Request) {
  try {
    return json(
      purchaseToken(request) ? await publicStatus(request) : availability(),
    );
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    z.object({}).strict().parse(await body(request, 1024));
    return json(await confirmPurchase(request));
  } catch (error) {
    return failure(error);
  }
}
