/**
 * 认证中间件
 *
 * 页面路由全部放行（由客户端 AuthGuard 保护）。
 * API 路由通过 Authorization: Bearer 头验证 JWT。
 * /api/auth/* 和 /api/health 为公开 API。
 *
 * 运行在 Edge Runtime，只验证 JWT 签名，不查数据库。
 */

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_API_PREFIXES = ["/api/auth/", "/api/health", "/api/oauth/"];

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

// 与 lib/auth.ts 中 extractBearerToken 逻辑一致。
// 重复实现在此是因为 middleware 运行在 Edge Runtime，不能 import Node.js 模块。
function extractBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (!auth) return null;
  const parts = auth.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") return null;
  return parts[1] || null;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 页面路由全部放行（客户端 AuthGuard 负责保护）
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // 放行公开 API
  if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // 验证 JWT
  const token = extractBearerToken(req);

  if (!token) {
    return NextResponse.json(
      { error: "未登录或登录已过期" },
      { status: 401 },
    );
  }

  try {
    await jwtVerify(token, getSecret());
    return NextResponse.next();
  } catch {
    return NextResponse.json(
      { error: "未登录或登录已过期" },
      { status: 401 },
    );
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
