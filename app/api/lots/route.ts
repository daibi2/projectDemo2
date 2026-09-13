import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { errorResponse } from "@/lib/errors";
import { createParkingService } from "@/lib/parking";

const parking = createParkingService(getDb());

export async function GET() {
  try {
    const user = await requireUser();
    return Response.json({ lots: parking.listLots(user.id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { name?: string; address?: string; totalSpots?: number };
    const lot = parking.createLot(user.id, {
      name: body.name ?? "",
      address: body.address ?? "",
      totalSpots: Number(body.totalSpots),
    });
    return Response.json({ lot }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
