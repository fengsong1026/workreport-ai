/**
 * 认证工具
 *
 * 基于 JWT（jose）+ bcryptjs 实现轻量认证。
 * Token 通过 Authorization: Bearer 头传递，客户端存储在 localStorage。
 */

import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

const TOKEN_TTL = "7d";
const SALT_ROUNDS = 10;

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET 未设置，生产环境必须配置 JWT_SECRET 环境变量");
    }
    return new TextEncoder().encode("dev-secret-change-me");
  }
  return new TextEncoder().encode(secret);
}

/** 签发 JWT */
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

const AUTH_COOKIE = "auth_token";

/** 从 Authorization: Bearer 头提取 token，fallback 到 cookie（OAuth 浏览器回调用） */
export function extractBearerToken(req: NextRequest): string | null {
  // 优先从 Authorization 头读取（API 调用）
  const auth = req.headers.get("authorization");
  if (auth) {
    const parts = auth.split(" ");
    if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
      return parts[1] || null;
    }
  }
  // Fallback: httpOnly cookie（浏览器导航场景，如 OAuth 回调）
  return req.cookies.get(AUTH_COOKIE)?.value ?? null;
}

/** 设置认证 cookie（供浏览器导航场景使用） */
export function setAuthCookie(res: NextResponse, token: string): NextResponse {
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 天
    path: "/",
  });
  return res;
}

/** 清除认证 cookie */
export function clearAuthCookie(res: NextResponse): NextResponse {
  res.cookies.delete(AUTH_COOKIE);
  return res;
}

/** 从请求获取 token */
export function getTokenFromRequest(req: NextRequest): string | undefined {
  return extractBearerToken(req) ?? undefined;
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
