import {
  publicStatus,
  availability,
  purchaseToken,
} from "@/lib/readiness/purchase";
import { json, failure } from "@/lib/readiness/http";
export async function GET(request: Request) {
  try {
    return json(
      purchaseToken(request) ? await publicStatus(request) : availability(),
    );
  } catch (error) {
    return failure(error);
  }
}
