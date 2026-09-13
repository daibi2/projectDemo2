import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { errorResponse, AppError } from "@/lib/errors";
import { createParkingService } from "@/lib/parking";

const parking = createParkingService(getDb());

export async function POST(_: Request, { params }: { params: Promise<{ recordId: string }> }) {
  try {
    const user = await requireUser();
    const recordId = Number((await params).recordId);
    if (!Number.isInteger(recordId) || recordId < 1) {
      throw new AppError("无效的停车记录。");
    }
    return Response.json({ record: parking.exitVehicle(user.id, recordId) });
  } catch (error) {
    return errorResponse(error);
  }
}
