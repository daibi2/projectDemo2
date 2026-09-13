import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { errorResponse } from "@/lib/errors";
import { createParkingService } from "@/lib/parking";

const parking = createParkingService(getDb());

export async function GET() {
  try {
    const user = await requireUser();
    return Response.json({ records: parking.listRecords(user.id) });
  } catch (error) {
    return errorResponse(error);
  }
}
