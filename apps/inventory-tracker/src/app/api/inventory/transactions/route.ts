import { NextResponse } from "next/server";
import { toErrorResponse } from "@pk/server/errors/api-error";
import { getInventoryApiContext } from "@/lib/api-context";
import { listTransactions } from "@pk/server/inventory/transactions";
import type { InventoryTransactionType } from "@pk/generated/prisma/client";

export async function GET(request: Request) {
  try {
    const ctx = await getInventoryApiContext();
    const { searchParams } = new URL(request.url);

    const transactions = await listTransactions(ctx, {
      productId: searchParams.get("productId") || undefined,
      transactionType:
        (searchParams.get("transactionType") as InventoryTransactionType) ||
        undefined,
      from: searchParams.get("from")
        ? new Date(searchParams.get("from")!)
        : undefined,
      to: searchParams.get("to")
        ? new Date(`${searchParams.get("to")}T23:59:59`)
        : undefined,
      limit: searchParams.get("limit")
        ? Number(searchParams.get("limit"))
        : 100,
    });

    return NextResponse.json({ transactions });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
