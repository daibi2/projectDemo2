import { addSessionCookie, createSession, login } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const user = await login({ email: body.email ?? "", password: body.password ?? "" });
    const response = Response.json({ user });
    addSessionCookie(response, await createSession(user));
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
