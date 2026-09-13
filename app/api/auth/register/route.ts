import { addSessionCookie, createSession, register } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: string; email?: string; password?: string };
    const user = await register({
      name: body.name ?? "",
      email: body.email ?? "",
      password: body.password ?? "",
    });
    const response = Response.json({ user }, { status: 201 });
    addSessionCookie(response, await createSession(user));
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
