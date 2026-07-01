/**
 * 修改密码
 * POST /api/auth/password
 * body: { oldPassword, newPassword }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let body: { oldPassword?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }

  const { oldPassword, newPassword } = body;
  if (!oldPassword || !newPassword) {
    return NextResponse.json(
      { error: "缺少 oldPassword 或 newPassword" },
      { status: 400 },
    );
  }

  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "新密码至少 8 位" },
      { status: 400 },
    );
  }

  const fullUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!fullUser) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  const valid = await verifyPassword(oldPassword, fullUser.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "旧密码错误" }, { status: 401 });
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  return NextResponse.json({ success: true });
}
