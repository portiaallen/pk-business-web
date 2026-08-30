import { NextResponse } from "next/server";
import { toErrorResponse } from "@/server/errors/api-error";
import { getInventoryApiContext } from "@/lib/api-context";
import {
  getInventoryActivityReport,
  toCsv,
} from "@/server/inventory/reports";

export async function GET(request: Request) {
  try {
    const ctx = await getInventoryApiContext();
    const { searchParams } = new URL(request.url);

    const activity = await getInventoryActivityReport(ctx, {
      from: searchParams.get("from")
        ? new Date(searchParams.get("from")!)
        : undefined,
      to: searchParams.get("to")
        ? new Date(`${searchParams.get("to")}T23:59:59`)
        : undefined,
    });

    if (searchParams.get("csv")) {
      const csv = toCsv(activity);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="inventory-activity.csv"',
        },
      });
    }

    return NextResponse.json({ activity });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
