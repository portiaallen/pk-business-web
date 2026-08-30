import { NextResponse } from "next/server";
import { toErrorResponse } from "@/server/errors/api-error";
import { getInventoryApiContext } from "@/lib/api-context";
import { getLocation, updateLocation } from "@/server/inventory/locations";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getInventoryApiContext();
    const location = await getLocation(ctx, id);
    return NextResponse.json({ location });
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

    const location = await updateLocation(ctx, id, {
      name: body.name,
      description: body.description,
      isActive: body.isActive,
    });

    return NextResponse.json({ location });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
