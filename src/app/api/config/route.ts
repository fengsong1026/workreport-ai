/**
 * 配置管理 API
 *
 * GET  /api/config       读取配置
 * POST /api/config       更新配置
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_CONFIG = {
  apiKey: "",
  apiBase: "https://api.deepseek.com",
  model: "deepseek-v4-flash",
  maxTokens: 4096,
};

async function getConfig() {
  const row = await prisma.config.findUnique({ where: { id: 0 } });
  if (!row) {
    // 从环境变量初始化
    return {
      ...DEFAULT_CONFIG,
      apiKey: process.env.OPENAI_API_KEY || "",
      apiBase: process.env.OPENAI_API_BASE || DEFAULT_CONFIG.apiBase,
      model: process.env.OPENAI_MODEL || DEFAULT_CONFIG.model,
    };
  }
  return {
    apiKey: row.apiKey,
    apiBase: row.apiBase,
    model: row.model,
    maxTokens: row.maxTokens,
  };
}

export async function GET() {
  const config = await getConfig();
  // 出于安全考虑，apiKey 部分掩码
  const masked = config.apiKey
    ? config.apiKey.slice(0, 6) + "..." + config.apiKey.slice(-4)
    : "";
  return NextResponse.json({ ...config, apiKeyMasked: masked });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { apiKey, apiBase, model, maxTokens } = body;

  const data = {
    apiKey: typeof apiKey === "string" ? apiKey : undefined,
    apiBase: typeof apiBase === "string" ? apiBase : undefined,
    model: typeof model === "string" ? model : undefined,
    maxTokens: typeof maxTokens === "number" ? maxTokens : undefined,
  };

  // 过滤 undefined
  const update: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) update[k] = v;
  }

  const row = await prisma.config.upsert({
    where: { id: 0 },
    create: { id: 0, ...update },
    update,
  });

  return NextResponse.json({
    success: true,
    config: {
      apiKey: row.apiKey,
      apiBase: row.apiBase,
      model: row.model,
      maxTokens: row.maxTokens,
    },
  });
}
