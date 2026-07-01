/**
 * 注册 API
 * POST /api/auth/register
 * body: { name, email, password }
 * 返回 token + 设置 auth_token cookie
 *
 * 限流：同一 IP 3 次/15 分钟
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken, setAuthCookie } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { RegisterSchema, parseBody } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }

  const parsed = parseBody(RegisterSchema, body);
  if (!parsed.success) return parsed.response;

  const { name, email, password } = parsed.data;

  // 速率限制（按 IP）
  // 注意：依赖反向代理正确设置 x-forwarded-for。取第一个 IP（客户端真实 IP）
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "unknown";

  if (!checkRateLimit(`register:${ip}`, 3, 15 * 60_000)) {
    return NextResponse.json(
      { error: "注册过于频繁，请 15 分钟后再试" },
      { status: 429 },
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "该邮箱已注册" },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name, email, passwordHash },
  });

  const token = await signToken(user.id);
  const response = NextResponse.json(
    { user: { id: user.id, name: user.name, email: user.email }, token },
    { status: 201 },
  );
  return setAuthCookie(response, token);
}
