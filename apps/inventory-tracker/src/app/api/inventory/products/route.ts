import { NextResponse } from "next/server";
import { toErrorResponse } from "@/server/errors/api-error";
import { getInventoryApiContext } from "@/lib/api-context";
import { listProducts, createProduct } from "@/server/inventory/products";

export async function GET(request: Request) {
  try {
    const ctx = await getInventoryApiContext();
    const { searchParams } = new URL(request.url);

    const products = await listProducts(ctx, {
      search: searchParams.get("search") || undefined,
      category: searchParams.get("category") || undefined,
      locationId: searchParams.get("locationId") || undefined,
      status: (searchParams.get("status") as "active" | "inactive" | "all") || "active",
      stock: (searchParams.get("stock") as "low" | "out" | "all") || "all",
      sort: (searchParams.get("sort") as "name" | "sku" | "quantity" | "updated") || "name",
      order: (searchParams.get("order") as "asc" | "desc") || "asc",
    });

    return NextResponse.json({ products });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getInventoryApiContext("STAFF");
    const body = await request.json();

    const product = await createProduct(ctx, {
      name: body.name,
      sku: body.sku,
      description: body.description,
      category: body.category,
      unit: body.unit || "each",
      initialQuantity: Number(body.initialQuantity) || 0,
      reorderThreshold: Number(body.reorderThreshold) || 0,
      locationId: body.locationId || undefined,
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
