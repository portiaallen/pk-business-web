import { NextResponse } from "next/server";
import { toErrorResponse } from "@/server/errors/api-error";
import { getInventoryApiContext } from "@/lib/api-context";
import { recordInventoryTransaction } from "@/server/inventory/transactions";
import type { InventoryTransactionType } from "@/generated/prisma/client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getInventoryApiContext("STAFF");
    const body = await request.json();

    const transaction = await recordInventoryTransaction(ctx, {
      productId: id,
      transactionType: body.transactionType as InventoryTransactionType,
      quantityChange:
        body.quantityChange !== undefined
          ? Number(body.quantityChange)
          : undefined,
      newQuantity:
        body.newQuantity !== undefined ? Number(body.newQuantity) : undefined,
      reason: body.reason,
      notes: body.notes,
      allowNegative: Boolean(body.allowNegative),
    });

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
