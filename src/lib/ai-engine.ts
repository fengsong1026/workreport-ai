/**
 * 共享 AI 生成引擎
 *
 * 所有插件共用此引擎：插件负责把数据格式化为文本，引擎负责模板填充、
 * prompt 构造与 OpenAI 兼容 API 调用。
 *
 * 兼容 OpenAI / DeepSeek / vLLM / Ollama / LiteLLM 等任意 /v1/chat/completions 接口。
 */

import OpenAI from "openai";
import { fillTemplate, loadTemplate } from "./templates";

/**
 * 平台配置
 */
export interface PlatformConfig {
  apiKey: string;
  apiBase: string;
  model: string;
  maxTokens: number;
}

const DEFAULT_API_BASE = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-v4-flash";
const DEFAULT_MAX_TOKENS = 4096;

/**
 * 加载配置：环境变量优先
 */
export function loadConfig(): PlatformConfig {
  return {
    apiKey: process.env.OPENAI_API_KEY || "",
    apiBase: process.env.OPENAI_API_BASE || DEFAULT_API_BASE,
    model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
    maxTokens: Number(process.env.OPENAI_MAX_TOKENS) || DEFAULT_MAX_TOKENS,
  };
}

/**
 * 构造 system prompt
 */
export function buildSystemPrompt(reportType: "weekly" | "daily" | "monthly" = "weekly"): string {
  const periodMap: Record<string, string> = {
    weekly: "周",
    daily: "日",
    monthly: "月",
  };
  const period = periodMap[reportType] || "周";

  return `你是一名专业的工作汇报撰写人。你的任务是根据用户提供的工作记录（可能来自代码提交、任务系统、日历、文档等多种数据源），生成一份简洁、结构清晰的中文工作${period}报。

撰写要求：
- 使用简体中文输出，专业且自然——像一个负责任的员工向管理者总结本周的工作。
- 按项目/来源分组。对每个项目，从高层次描述"做了什么"和"为什么"——不要只罗列原始记录。
- 识别跨记录的主题和模式（例如"本周专注于认证模块重构"）。
- 突出重要变更、新功能、缺陷修复和关键进展。
- 记录任何未完成的工作或进行中的任务，以反映持续进行的工作。
- 报告应简洁但充实，3-5 分钟内可读完。
- 每个章节使用项目符号以提高可读性。
- 填写模板的所有章节——不要留空。如果某章节确实没有内容，写"本周无相关内容。"
- 保留模板的 markdown 结构不变。
- 只输出最终的${period}报 markdown——不要添加前言或评论。`;
}

/**
 * 构造 user message
 */
export function buildUserMessage(filledTemplate: string, sourceLabel = "工作记录"): string {
  return `请根据以下模板和${sourceLabel}生成一份工作报告。根据提供的内容填写模板的所有章节。

## 模板

${filledTemplate}

请将"工作详情"下的原始记录替换为你的叙述性总结（按项目/来源分组，描述完成了什么工作）。保留所有章节标题和整体结构。以 markdown 格式输出完整报告，使用简体中文。`;
}

/**
 * 调用 OpenAI 兼容 Chat Completions API，返回响应文本
 */
export async function callOpenAICompatibleApi(
  systemPrompt: string,
  userMessage: string,
  config: PlatformConfig,
): Promise<string> {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.apiBase,
    maxRetries: 2,
    timeout: 60000,
  });

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: userMessage });

  const response = await client.chat.completions.create({
    model: config.model,
    messages,
    max_tokens: config.maxTokens,
  });

  return response.choices[0]?.message?.content || "";
}

/**
 * 生成报告的完整流程：模板填充 → prompt 构造 → API 调用
 *
 * @param formattedRecords 插件 formatForPrompt() 的输出
 * @param templatePath 模板文件路径
 * @param variables 模板占位符变量（不含记录本身）
 * @param reportType weekly | daily | monthly
 * @param sourceLabel 数据源描述（用于 prompt）
 * @param dryRun 仅打印 prompt 不调用 API
 * @param config 平台配置（undefined 则自动加载）
 * @returns 生成的报告文本（dry_run 时返回 prompt 文本）
 */
export async function generateReport(
  formattedRecords: string,
  templatePath: string,
  variables: Record<string, string | number>,
  reportType: "weekly" | "daily" | "monthly" = "weekly",
  sourceLabel = "工作记录",
  dryRun = false,
  config?: PlatformConfig,
): Promise<string> {
  const cfg = config ?? loadConfig();

  // 填充模板
  const template = loadTemplate(templatePath);
  const allVars: Record<string, string | number> = { ...variables, RECORDS: formattedRecords };
  const filled = fillTemplate(template, allVars);

  // 构造 prompt
  const systemPrompt = buildSystemPrompt(reportType);
  const userMessage = buildUserMessage(filled, sourceLabel);

  if (dryRun) {
    const sep = "=".repeat(60);
    return (
      `${sep}\n  DRY RUN — PROMPT\n${sep}\n\n` +
      `--- SYSTEM PROMPT (${systemPrompt.length} chars) ---\n${systemPrompt}\n\n` +
      `--- USER MESSAGE (${userMessage.length} chars) ---\n${userMessage}\n\n` +
      `${sep}\n  END DRY RUN\n${sep}`
    );
  }

  // 调用 API
  if (!cfg.apiKey) {
    throw new Error(
      "未找到 API Key（已检查 $OPENAI_API_KEY）。请配置后重试，或使用 --dry-run 预览。",
    );
  }

  return callOpenAICompatibleApi(systemPrompt, userMessage, cfg);
}
