/**
 * 登出 API
 * POST /api/auth/logout
 *
 * 客户端负责删除 localStorage 中的 token。
 * 这里只返回确认。
 */

import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ success: true });
  return clearAuthCookie(response);
}
