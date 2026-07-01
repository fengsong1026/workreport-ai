/**
 * 修改用户名称
 * PATCH /api/auth/profile
 * body: { name }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }

  const { name } = body;
  if (!name || !name.trim()) {
    return NextResponse.json({ error: "缺少 name" }, { status: 400 });
  }

  if (name.trim().length > 100) {
    return NextResponse.json({ error: "用户名最长 100 个字符" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { name: name.trim() },
    select: { id: true, name: true, email: true },
  });

  return NextResponse.json({ user: updated });
}
