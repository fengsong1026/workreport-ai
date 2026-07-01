/**
 * 登录 API
 * POST /api/auth/login
 * body: { email, password }
 * 返回 token，客户端存储在 localStorage
 *
 * 限流：同一邮箱 5 次/15 分钟
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signToken, setAuthCookie } from "@/lib/auth";
import { checkRateLimit, resetRateLimit, getRemainingAttempts } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // 安全解析 JSON
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }

  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: "缺少邮箱或密码" },
      { status: 400 },
    );
  }

  // 速率限制
  if (!checkRateLimit(`login:${email}`, 5, 15 * 60_000)) {
    return NextResponse.json(
      { error: "登录尝试过于频繁，请 15 分钟后再试" },
      { status: 429 },
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json(
      { error: "邮箱或密码错误" },
      { status: 401 },
    );
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "邮箱或密码错误" },
      { status: 401 },
    );
  }

  // 登录成功，重置限流计数
  resetRateLimit(`login:${email}`);

  const token = await signToken(user.id);
  const response = NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email },
    token,
  });
  return setAuthCookie(response, token);
}
