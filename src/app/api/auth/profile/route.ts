/**
 * 修改用户名称
 * PATCH /api/auth/profile
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileSchema, parseBody } from "@/lib/schemas";

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }

  const parsed = parseBody(ProfileSchema, body);
  if (!parsed.success) return parsed.response;

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { name: parsed.data.name.trim() },
    select: { id: true, name: true, email: true },
  });

  return NextResponse.json({ user: updated });
}
