import { NextResponse } from "next/server";
import { toErrorResponse } from "@/server/errors/api-error";
import { getInventoryApiContext } from "@/lib/api-context";
import { getInventoryDashboard } from "@/server/inventory/dashboard";

export async function GET() {
  try {
    const ctx = await getInventoryApiContext();
    const dashboard = await getInventoryDashboard(ctx);
    return NextResponse.json({ dashboard });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
