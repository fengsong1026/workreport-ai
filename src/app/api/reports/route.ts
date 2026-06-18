/**
 * 报告管理 API
 *
 * GET /api/reports               列出所有历史报告
 * GET /api/reports/:id           获取单个报告详情
 * DELETE /api/reports/:id        删除报告
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const type = url.searchParams.get("type");
  const limit = Number(url.searchParams.get("limit")) || 50;

  // 获取单个报告详情
  if (id) {
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) {
      return NextResponse.json({ error: "报告不存在" }, { status: 404 });
    }
    return NextResponse.json({ report });
  }

  // 列表查询
  const where = type ? { type } : {};
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
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "缺少 id 参数" }, { status: 400 });
  }

  try {
    await prisma.report.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "报告不存在" }, { status: 404 });
  }
}
