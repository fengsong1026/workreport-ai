/**
 * 认证工具
 *
 * 基于 JWT（jose）+ bcryptjs 实现轻量认证。
 * JWT 存于 httpOnly cookie，middleware 验证。
 */

import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

const COOKIE_NAME = "wr_session";
const TOKEN_TTL = "7d";
const SALT_ROUNDS = 10;

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || "dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

/** 签发 JWT 并设置到 cookie */
export async function signToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(getSecret());
}

/** 验证 JWT，返回 userId 或 null */
export async function verifyToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload.sub || null;
  } catch {
    return null;
  }
}

/** 哈希密码 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/** 验证密码 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** 设置 session cookie */
export function setSessionCookie(
  res: NextResponse,
  token: string,
): NextResponse {
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 天
    path: "/",
  });
  return res;
}

/** 清除 session cookie */
export function clearSessionCookie(res: NextResponse): NextResponse {
  res.cookies.delete(COOKIE_NAME);
  return res;
}

/** 从请求获取 session token */
export function getTokenFromRequest(req: NextRequest): string | undefined {
  return req.cookies.get(COOKIE_NAME)?.value;
}

/**
 * 从请求获取当前用户
 *
 * 在 API route 中使用，返回 User 对象或 null。
 */
export async function getSessionUser(req: NextRequest) {
  const token = getTokenFromRequest(req);
  if (!token) return null;

  const userId = await verifyToken(token);
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return user;
}

/**
 * 要求用户已登录，否则返回 401
 *
 * 在 API route 中使用：
 * ```ts
 * const user = await requireUser(req);
 * if (user instanceof NextResponse) return user; // 未登录
 * // user 已确认登录
 * ```
 */
export async function requireUser(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json(
      { error: "未登录" },
      { status: 401 },
    );
  }
  return user;
}

export { COOKIE_NAME };
