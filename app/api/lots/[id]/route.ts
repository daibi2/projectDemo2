import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { errorResponse } from "@/lib/errors";
import { createParkingService } from "@/lib/parking";

const parking = createParkingService(getDb());

function lotId(params: { id: string }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) throw new Error("Invalid lot id");
  return id;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    return Response.json({ lot: parking.getLot(user.id, lotId(await params)) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { name?: string; address?: string };
    const lot = parking.updateLot(user.id, lotId(await params), {
      name: body.name ?? "",
      address: body.address ?? "",
    });
    return Response.json({ lot });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    parking.deleteLot(user.id, lotId(await params));
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
