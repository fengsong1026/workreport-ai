/**
 * 认证中间件
 *
 * 保护所有页面和 API（除了 /login, /register, /api/auth/*）。
 * 验证 JWT cookie，未登录则重定向到登录页或返回 401。
 *
 * 运行在 Edge Runtime，只验证 JWT 签名，不查数据库。
 */

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "wr_session";
const PUBLIC_PAGES = ["/", "/login", "/register"];
const PUBLIC_API_PREFIXES = ["/api/auth/", "/api/health"];

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || "dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 放行公开页面
  if (PUBLIC_PAGES.includes(pathname)) {
    return NextResponse.next();
  }

  // 放行公开 API
  if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // 验证 JWT
  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return handleUnauth(req);
  }

  try {
    await jwtVerify(token, getSecret());
    return NextResponse.next();
  } catch {
    return handleUnauth(req);
  }
}

function handleUnauth(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "未登录或登录已过期" },
      { status: 401 },
    );
  }

  // 页面重定向到登录
  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
