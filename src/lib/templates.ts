/**
 * 模板管理：加载与 {{占位符}} 填充
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * 平台项目根目录与默认模板目录
 */
export const PROJECT_DIR = process.cwd();
export const TEMPLATES_DIR = join(PROJECT_DIR, "templates");

/**
 * 内置默认周报模板（当模板文件缺失时回退使用）
 */
export const DEFAULT_WEEKLY_TEMPLATE = `# 周工作报告 — {{WEEK}}（{{DATE_RANGE}}）

## 概览

## 各项目工作

{{RECORDS}}

## 重点亮点

## 挑战与阻塞

## 下周计划

---

> 📊 基于 {{RECORD_COUNT}} 条记录（{{PROJECT_COUNT}} 个项目）生成
> 🤖 AI 生成周报 — {{GENERATED_AT}}
`;

/**
 * 返回某报告类型的默认模板路径
 */
export function defaultTemplatePath(reportType: "daily" | "weekly" | "monthly" = "weekly"): string {
  return join(TEMPLATES_DIR, `${reportType}-report.md`);
}

/**
 * 加载模板文件。文件不存在时回退到内置默认模板
 */
export function loadTemplate(templatePath: string): string {
  if (existsSync(templatePath)) {
    return readFileSync(templatePath, "utf-8");
  }
  console.warn(`[!] 模板未找到: ${templatePath}，使用内置默认模板。`);
  return DEFAULT_WEEKLY_TEMPLATE;
}

/**
 * 将模板中的 {{PLACEHOLDER}} 替换为 variables 中的值
 */
export function fillTemplate(template: string, variables: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    // 对 RECORDS 类变量转义 {{ 防止与模板占位符冲突
    const safeValue = String(value).replaceAll("{{", "{\\{");
    result = result.replaceAll(`{{${key}}}`, safeValue);
  }
  return result;
}
