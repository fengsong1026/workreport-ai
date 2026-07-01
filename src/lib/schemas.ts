/**
 * API 输入校验 Schema（Zod）
 *
 * 所有 POST/PATCH 路由共用此模块定义的 schema，
 * 一处定义，类型自动推导，校验逻辑不遗漏。
 */

import { z } from "zod";

// ── Auth ──

export const LoginSchema = z.object({
  email: z.string().min(1, "邮箱不能为空"),
  password: z.string().min(1, "密码不能为空"),
});

export const RegisterSchema = z.object({
  name: z.string().min(1, "用户名不能为空").max(100, "用户名最长 100 个字符"),
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(8, "密码至少 8 位"),
});

export const PasswordSchema = z.object({
  oldPassword: z.string().min(1, "旧密码不能为空"),
  newPassword: z.string().min(8, "新密码至少 8 位"),
});

export const ProfileSchema = z.object({
  name: z.string().min(1, "用户名不能为空").max(100, "用户名最长 100 个字符"),
});

// ── Generate ──

export const GenerateSchema = z.object({
  type: z.enum(["daily", "weekly", "monthly"]).optional().default("weekly"),
  week: z.number().int().optional(),
  year: z.number().int().optional(),
  month: z.number().int().min(1).max(12).optional(),
  plugin: z.string().optional(),
  allAuthors: z.boolean().optional(),
  author: z.string().optional(),
  force: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

// ── Collect ──

export const CollectSchema = z.object({
  plugin: z.string().optional().default("git"),
});

// ── Data Sources ──

export const DataSourcesPostSchema = z.object({
  name: z.string().min(1, "数据源名称不能为空"),
  action: z.enum(["select-repos", "disconnect"]).optional(),
  repos: z.array(z.number()).optional(),
});

// ── Schedule ──

export const ScheduleCreateSchema = z.object({
  name: z.string().min(1, "任务名称不能为空").max(200, "任务名称最长 200 个字符"),
  schedule: z.string().min(1, "调度时间不能为空"),
  reportType: z.enum(["daily", "weekly", "monthly"]).optional().default("weekly"),
  plugin: z.string().optional(),
});

export const ScheduleUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  schedule: z.string().optional(),
  reportType: z.enum(["daily", "weekly", "monthly"]).optional(),
  plugin: z.string().optional(),
});

// ── Helper: 将 Zod 校验结果转为 API 响应 ──

import { NextResponse } from "next/server";

/** 校验请求体，失败时返回 400 响应；成功时返回解析后的数据 */
export function parseBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown,
): { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(body);
  if (!result.success) {
    const message = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return {
      success: false,
      response: NextResponse.json({ error: message || "无效的请求体" }, { status: 400 }),
    };
  }
  return { success: true, data: result.data };
}

export type { z };
