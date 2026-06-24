/**
 * 报告生成核心逻辑（从 API route 和定时任务共用）
 *
 * generateReportForUser() 是唯一入口：
 *   1. 加载插件 → 读取数据源记录 → 格式化为 prompt 文本
 *   2. 加载 AI 配置（DB > env）→ 调用 AI 引擎生成报告
 *   3. 保存到 DB + 本地 .md 文件
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { getRegistry } from "./registry";
import { getRange } from "./dates";
import { defaultTemplatePath } from "./templates";
import { generateReport, loadConfig, PlatformConfig } from "./ai-engine";
import { prisma } from "./prisma";

export interface GenerateOptions {
  type: "daily" | "weekly" | "monthly";
  week?: number;
  year?: number;
  month?: number;
  plugin?: string;
  allAuthors?: boolean;
  author?: string;
  dryRun?: boolean;
}

export interface GenerateResult {
  success: boolean;
  reportId?: string;
  content: string;
  stats: {
    recordCount: number;
    projectCount: number;
    timeRange: { label: string; range: string };
  };
  filePath?: string;
  error?: string;
}

/**
 * 从数据库或环境变量加载 AI 配置
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

/**
 * 为指定用户生成报告
 *
 * 被 /api/generate 和定时调度器共用。
 * 不依赖 NextRequest，纯逻辑函数。
 */
export async function generateReportForUser(
  userId: string,
  options: GenerateOptions,
): Promise<GenerateResult> {
  const reportType = options.type || "weekly";
  const registry = getRegistry();

  // 选择插件
  let plugins;
  if (options.plugin) {
    const p = registry.get(options.plugin);
    if (!p) {
      return {
        success: false,
        content: "",
        stats: { recordCount: 0, projectCount: 0, timeRange: { label: "", range: "" } },
        error: `未知插件: ${options.plugin}`,
      };
    }
    plugins = [p];
  } else {
    plugins = registry.available();
    if (plugins.length === 0) {
      return {
        success: false,
        content: "",
        stats: { recordCount: 0, projectCount: 0, timeRange: { label: "", range: "" } },
        error: "没有已落地的插件",
      };
    }
  }

  // 时间范围
  const timeRange = getRange(reportType, {
    week: options.week,
    year: options.year,
    month: options.month,
  });

  // 作者过滤
  const email = options.allAuthors ? undefined : options.author;

  // 读取并格式化各插件记录
  const formattedParts: string[] = [];
  let totalCount = 0;
  const totalProjects = new Set<string>();

  for (const p of plugins) {
    const records = await p.read(timeRange.start, timeRange.end, email, userId);
    if (records.length === 0) continue;

    totalCount += records.length;
    for (const r of records) totalProjects.add(r.project || "unknown");

    const part = p.formatForPrompt(records);
    if (part.trim()) {
      formattedParts.push(`#### 数据源：${p.meta.displayName}\n${part}`);
    }
  }

  if (totalCount === 0) {
    return {
      success: false,
      content: "",
      stats: {
        recordCount: 0,
        projectCount: 0,
        timeRange: { label: timeRange.label, range: timeRange.dateRangeStr },
      },
      error: "该时间区间内没有找到任何记录",
    };
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
      options.dryRun || false,
      config,
    );

    if (options.dryRun) {
      return {
        success: true,
        content: report,
        stats: {
          recordCount: totalCount,
          projectCount: totalProjects.size,
          timeRange: { label: timeRange.label, range: timeRange.dateRangeStr },
        },
      };
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
        userId,
      },
    });

    // 同时保存到本地 .md 文件
    const reportsDir = join(process.cwd(), "data", "reports");
    mkdirSync(reportsDir, { recursive: true });
    const safeLabel = timeRange.label.replace(/\s+/g, "-").replace(/[()]/g, "");
    const filePath = join(reportsDir, `${reportType}-${safeLabel}.md`);
    writeFileSync(filePath, report, "utf-8");

    return {
      success: true,
      reportId: saved.id,
      content: report,
      stats: {
        recordCount: totalCount,
        projectCount: totalProjects.size,
        timeRange: { label: timeRange.label, range: timeRange.dateRangeStr },
      },
      filePath,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      content: "",
      stats: {
        recordCount: totalCount,
        projectCount: totalProjects.size,
        timeRange: { label: timeRange.label, range: timeRange.dateRangeStr },
      },
      error: msg,
    };
  }
}
