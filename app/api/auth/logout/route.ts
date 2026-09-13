import { clearSessionCookie } from "@/lib/auth";

export async function POST() {
  const response = Response.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
