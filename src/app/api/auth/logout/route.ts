/**
 * 登出 API
 * POST /api/auth/logout
 */

import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ success: true });
  return clearSessionCookie(res);
}
