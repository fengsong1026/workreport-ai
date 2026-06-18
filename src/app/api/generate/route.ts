/**
 * 生成报告 API
 *
 * POST /api/generate
 *
 * 请求体：
 *   { type: "weekly", week?, year?, month?, plugin?, allAuthors?, force?, dryRun? }
 */

import { NextRequest, NextResponse } from "next/server";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { getRegistry } from "@/lib/registry";
import { getRange } from "@/lib/dates";
import { defaultTemplatePath } from "@/lib/templates";
import { generateReport, loadConfig, PlatformConfig } from "@/lib/ai-engine";
import { prisma } from "@/lib/prisma";

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

/**
 * 从数据库或环境变量加载配置
 */
async function loadDbConfig(): Promise<PlatformConfig> {
  const row = await prisma.config.findUnique({ where: { id: 0 } });
  if (row && row.apiKey) {
    return {
      apiKey: row.apiKey,
      apiBase: row.apiBase,
      model: row.model,
      maxTokens: row.maxTokens,
    };
  }
  return loadConfig();
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as GenerateBody;
  const reportType = body.type || "weekly";

  const registry = getRegistry();

  // 选择插件
  let plugins;
  if (body.plugin) {
    const p = registry.get(body.plugin);
    if (!p) {
      return NextResponse.json(
        { error: `未知插件: ${body.plugin}` },
        { status: 400 },
      );
    }
    plugins = [p];
  } else {
    plugins = registry.available();
    if (plugins.length === 0) {
      return NextResponse.json(
        { error: "没有已落地的插件" },
        { status: 400 },
      );
    }
  }

  // 时间范围
  const timeRange = getRange(reportType, {
    week: body.week,
    year: body.year,
    month: body.month,
  });

  // 作者过滤：allAuthors=true 或未指定 author 时不过滤
  let email: string | undefined;
  if (body.allAuthors) {
    email = undefined;
  } else if (body.author) {
    email = body.author;
  } else {
    email = undefined;
  }

  // 读取并格式化各插件记录
  const formattedParts: string[] = [];
  let totalCount = 0;
  const totalProjects = new Set<string>();

  for (const p of plugins) {
    const records = await p.read(timeRange.start, timeRange.end, email);
    if (records.length === 0) continue;

    totalCount += records.length;
    for (const r of records) totalProjects.add(r.project || "unknown");

    const part = p.formatForPrompt(records);
    if (part.trim()) {
      formattedParts.push(`#### 数据源：${p.meta.displayName}\n${part}`);
    }
  }

  if (totalCount === 0) {
    return NextResponse.json(
      {
        error: "该时间区间内没有找到任何记录",
        timeRange: { label: timeRange.label, range: timeRange.dateRangeStr },
      },
      { status: 404 },
    );
  }

  const formattedRecords = formattedParts.join("\n\n");
  const sourceLabel = plugins.map((p) => p.meta.displayName).join("、");

  // 模板变量
  const templatePath = defaultTemplatePath(reportType);
  const variables: Record<string, string | number> = {
    WEEK: timeRange.label,
    DATE_RANGE: timeRange.dateRangeStr,
    RECORD_COUNT: totalCount,
    PROJECT_COUNT: totalProjects.size,
    GENERATED_AT: new Date().toISOString().replace("T", " ").slice(0, 16),
  };

  // 加载配置
  const config = await loadDbConfig();

  // 生成
  try {
    const report = await generateReport(
      formattedRecords,
      templatePath,
      variables,
      reportType,
      sourceLabel,
      body.dryRun || false,
      config,
    );

    if (body.dryRun) {
      return NextResponse.json({
        dryRun: true,
        prompt: report,
        stats: {
          recordCount: totalCount,
          projectCount: totalProjects.size,
          timeRange: { label: timeRange.label, range: timeRange.dateRangeStr },
        },
      });
    }

    // 保存到数据库
    const saved = await prisma.report.create({
      data: {
        type: reportType,
        label: timeRange.label,
        dateRange: timeRange.dateRangeStr,
        recordCount: totalCount,
        projectCount: totalProjects.size,
        content: report,
      },
    });

    // 同时保存到本地 .md 文件
    const reportsDir = join(process.cwd(), "data", "reports");
    mkdirSync(reportsDir, { recursive: true });
    const safeLabel = timeRange.label.replace(/\s+/g, "-").replace(/[()]/g, "");
    const filePath = join(reportsDir, `${reportType}-${safeLabel}.md`);
    writeFileSync(filePath, report, "utf-8");

    return NextResponse.json({
      success: true,
      reportId: saved.id,
      content: report,
      stats: {
        recordCount: totalCount,
        projectCount: totalProjects.size,
        timeRange: { label: timeRange.label, range: timeRange.dateRangeStr },
      },
      filePath,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
