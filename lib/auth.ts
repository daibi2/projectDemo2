import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "parking_session";
function sessionSecret() {
  const value = process.env.JWT_SECRET ?? (process.env.NODE_ENV !== "production" ? "development-only-secret-change-before-production" : "");
  if (!value) throw new AppError("服务尚未配置 JWT_SECRET。", 500, "AUTH_CONFIGURATION_ERROR");
  return new TextEncoder().encode(value);
}

export type SessionUser = { id: number; name: string; email: string };

export async function createSession(user: SessionUser) {
  return new SignJWT({ name: user.name, email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(sessionSecret());
}

export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    const id = Number(payload.sub);
    if (!Number.isSafeInteger(id)) return null;
    const user = getDb()
      .prepare("SELECT id, name, email FROM users WHERE id = ?")
      .get(id) as SessionUser | undefined;
    return user ?? null;
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new AppError("请先登录。", 401, "UNAUTHENTICATED");
  return user;
}

export function addSessionCookie(response: Response, token: string) {
  response.headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
}

export function clearSessionCookie(response: Response) {
  response.headers.append("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export async function register(input: { name: string; email: string; password: string }) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name || name.length > 80) throw new AppError("请输入 1–80 个字符的姓名。");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError("请输入有效的邮箱地址。");
  if (input.password.length < 8) throw new AppError("密码至少需要 8 位。");
  const db = getDb();
  const found = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (found) throw new AppError("该邮箱已注册，请直接登录。", 409, "EMAIL_EXISTS");
  const result = db
    .prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)")
    .run(name, email, await bcrypt.hash(input.password, 12));
  return { id: Number(result.lastInsertRowid), name, email };
}

export async function login(input: { email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const user = getDb()
    .prepare("SELECT id, name, email, password_hash FROM users WHERE email = ?")
    .get(email) as (SessionUser & { password_hash: string }) | undefined;
  if (!user || !(await bcrypt.compare(input.password, user.password_hash))) {
    throw new AppError("邮箱或密码不正确。", 401, "INVALID_CREDENTIALS");
  }
  return { id: user.id, name: user.name, email: user.email };
}
