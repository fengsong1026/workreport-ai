/**
 * 获取当前用户信息 + 统计
 * GET /api/auth/me
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const [reportCount, dataSourceCount] = await Promise.all([
    prisma.report.count({ where: { userId: user.id } }),
    prisma.dataSource.count({
      where: { userId: user.id, connected: true },
    }),
  ]);

  return NextResponse.json({
    user,
    stats: { reportCount, dataSourceCount },
  });
}
