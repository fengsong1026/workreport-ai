/**
 * 生成报告 API
 *
 * POST /api/generate
 *
 * 请求体：
 *   { type: "weekly", week?, year?, month?, plugin?, allAuthors?, force?, dryRun? }
 *
 * 限流：每用户 10 次/小时
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { generateReportForUser } from "@/lib/generate";
import { checkRateLimit } from "@/lib/rate-limit";

interface GenerateBody {
  type?: "daily" | "weekly" | "monthly";
  week?: number;
  year?: number;
  month?: number;
  plugin?: string;
  allAuthors?: boolean;
  author?: string;
  force?: boolean;
  dryRun?: boolean;
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  // 速率限制（按用户 ID）
  if (!checkRateLimit(`generate:${user.id}`, 10, 60 * 60_000)) {
    return NextResponse.json(
      { error: "报告生成过于频繁，请稍后再试" },
      { status: 429 },
    );
  }

  // 安全解析 JSON
  let body: GenerateBody;
  try {
    body = (await req.json()) as GenerateBody;
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }

  const reportType = body.type || "weekly";

  const result = await generateReportForUser(user.id, {
    type: reportType,
    week: body.week,
    year: body.year,
    month: body.month,
    plugin: body.plugin,
    allAuthors: body.allAuthors,
    author: body.author,
    dryRun: body.dryRun,
  });

  if (!result.success) {
    const status = result.error?.includes("没有找到") ? 404 : 500;
    return NextResponse.json(
      {
        error: result.error,
        stats: result.stats.timeRange
          ? { timeRange: result.stats.timeRange }
          : undefined,
      },
      { status },
    );
  }

  if (body.dryRun) {
    return NextResponse.json({
      dryRun: true,
      prompt: result.content,
      stats: result.stats,
    });
  }

  return NextResponse.json({
    success: true,
    reportId: result.reportId,
    content: result.content,
    stats: result.stats,
    filePath: result.filePath,
  });
}
