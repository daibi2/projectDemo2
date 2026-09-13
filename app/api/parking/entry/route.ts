import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { errorResponse } from "@/lib/errors";
import { createParkingService } from "@/lib/parking";

const parking = createParkingService(getDb());

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { lotId?: number; plateNumber?: string; type?: string };
    const record = parking.enterVehicle(user.id, {
      lotId: Number(body.lotId),
      plateNumber: body.plateNumber ?? "",
      type: body.type ?? "",
    });
    return Response.json({ record }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
