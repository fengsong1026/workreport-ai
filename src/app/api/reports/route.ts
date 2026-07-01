/**
 * 报告管理 API
 *
 * GET /api/reports               列出当前用户的历史报告
 * GET /api/reports?id=...        获取单个报告详情（仅本人）
 * DELETE /api/reports?id=...     删除报告（仅本人）
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const type = url.searchParams.get("type");
  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit !== null
    ? Math.min(Math.max(Number(rawLimit), 1), 200)
    : 50;

  // 获取单个报告详情
  if (id) {
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report || report.userId !== user.id) {
      return NextResponse.json({ error: "报告不存在" }, { status: 404 });
    }
    return NextResponse.json({ report });
  }

  // 列表查询（仅当前用户）
  const where = {
    userId: user.id,
    ...(type ? { type } : {}),
  };
  const reports = await prisma.report.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      label: true,
      dateRange: true,
      recordCount: true,
      projectCount: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ reports });
}

export async function DELETE(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "缺少 id 参数" }, { status: 400 });
  }

  try {
    // 复合 where：id + userId，不归属则抛错
    await prisma.report.delete({ where: { id, userId: user.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "报告不存在" }, { status: 404 });
  }
}
