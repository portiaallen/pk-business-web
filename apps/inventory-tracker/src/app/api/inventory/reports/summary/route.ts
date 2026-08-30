import { NextResponse } from "next/server";
import { toErrorResponse } from "@pk/server/errors/api-error";
import { getInventoryApiContext } from "@/lib/api-context";
import {
  getInventorySummaryReport,
  toCsv,
} from "@pk/server/inventory/reports";

export async function GET(request: Request) {
  try {
    const ctx = await getInventoryApiContext();
    const { searchParams } = new URL(request.url);
    const summary = await getInventorySummaryReport(ctx);

    if (searchParams.get("csv")) {
      const csv = toCsv(summary);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="inventory-summary.csv"',
        },
      });
    }

    return NextResponse.json({ summary });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
