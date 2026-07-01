/**
 * 注册 API
 * POST /api/auth/register
 * body: { name, email, password }
 * 返回 token，客户端存储在 localStorage
 *
 * 限流：同一 IP 3 次/15 分钟
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken, setAuthCookie } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // 安全解析 JSON
  let body: { name?: string; email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }

  const { name, email, password } = body;

  if (!name || !email || !password) {
    return NextResponse.json(
      { error: "缺少必填字段（name, email, password）" },
      { status: 400 },
    );
  }

  // 输入长度校验
  if (name.length > 100) {
    return NextResponse.json({ error: "用户名最长 100 个字符" }, { status: 400 });
  }

  // Email 格式校验
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 });
  }

  // 密码最少 8 位
  if (password.length < 8) {
    return NextResponse.json(
      { error: "密码至少 8 位" },
      { status: 400 },
    );
  }

  // 速率限制（按 IP）
  // 注意：依赖反向代理正确设置 x-forwarded-for。取第一个 IP（客户端真实 IP）
  const rawIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "unknown";
  const ip = rawIp;
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
    {
      user: { id: user.id, name: user.name, email: user.email },
      token,
    },
    { status: 201 },
  );
  return setAuthCookie(response, token);
}
