import { NextResponse } from "next/server";
import { toErrorResponse } from "@/server/errors/api-error";
import { getInventoryApiContext } from "@/lib/api-context";
import { getProduct, updateProduct } from "@/server/inventory/products";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getInventoryApiContext();
    const product = await getProduct(ctx, id);
    return NextResponse.json({ product });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getInventoryApiContext("STAFF");
    const body = await request.json();

    const product = await updateProduct(ctx, id, {
      name: body.name,
      sku: body.sku,
      description: body.description,
      category: body.category,
      unit: body.unit,
      reorderThreshold:
        body.reorderThreshold !== undefined
          ? Number(body.reorderThreshold)
          : undefined,
      locationId: body.locationId !== undefined ? body.locationId || null : undefined,
      isActive: body.isActive,
    });

    return NextResponse.json({ product });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
