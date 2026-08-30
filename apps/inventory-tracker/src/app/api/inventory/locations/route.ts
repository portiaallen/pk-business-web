import { NextResponse } from "next/server";
import { toErrorResponse } from "@/server/errors/api-error";
import { getInventoryApiContext } from "@/lib/api-context";
import { listLocations, createLocation } from "@/server/inventory/locations";

export async function GET(request: Request) {
  try {
    const ctx = await getInventoryApiContext();
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("activeOnly") !== "false";

    const locations = await listLocations(ctx, activeOnly);
    return NextResponse.json({ locations });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getInventoryApiContext("STAFF");
    const body = await request.json();

    const location = await createLocation(ctx, {
      name: body.name,
      description: body.description,
    });

    return NextResponse.json({ location }, { status: 201 });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
