/**
 * Task Reporter 插件 —— 任务系统数据源（规划中）
 *
 * 数据源：Jira / Linear / 飞书任务
 * 目标用户：产品 / 项目管理
 *
 * 落地时需实现：
 *   - collect(): 对接 Jira / Linear / 飞书任务 API，拉取任务变更记录
 *   - read():    读取 data/sources/task/*.jsonl
 *   - formatForPrompt(): 按项目/状态分组格式化
 */

import { PluginMeta, WorkRecord } from "@/lib/models";
import { CollectArgs, DataSourcePlugin, defaultStats } from "@/lib/plugin";

export class TaskPlugin implements DataSourcePlugin {
  readonly meta = new PluginMeta(
    "task",
    "Task Reporter",
    "Jira / Linear / 飞书任务",
    "产品 / 项目管理",
    "planned",
  );

  constructor(
    private projectDir: string,
    private config: Record<string, unknown> = {},
  ) {}

  async collect(_args: CollectArgs): Promise<number> {
    throw new Error(
      "Task Reporter 尚在规划中。将对接 Jira / Linear / 飞书任务 API 采集任务变更。",
    );
  }

  async read(
    _since: Date,
    _until: Date,
    _email?: string,
  ): Promise<WorkRecord[]> {
    return [];
  }

  formatForPrompt(_records: WorkRecord[]): string {
    return "";
  }

  stats(records: WorkRecord[]): { count: number; projectCount: number } {
    return defaultStats(records);
  }
}
