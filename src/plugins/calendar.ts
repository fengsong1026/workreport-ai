/**
 * Calendar Reporter 插件 —— 日历数据源（规划中）
 *
 * 数据源：Google Calendar / 企业微信日历
 * 目标用户：所有岗位
 */

import { PluginMeta, WorkRecord } from "@/lib/models";
import { CollectArgs, DataSourcePlugin, defaultStats } from "@/lib/plugin";

export class CalendarPlugin implements DataSourcePlugin {
  readonly meta = new PluginMeta(
    "calendar",
    "Calendar Reporter",
    "Google Calendar / 企业微信日历",
    "所有岗位",
    "planned",
  );

  constructor(
    private projectDir: string,
    private config: Record<string, unknown> = {},
  ) {}

  async collect(_args: CollectArgs): Promise<number> {
    throw new Error(
      "Calendar Reporter 尚在规划中。将对接 Google Calendar / 企业微信日历 API 采集日程。",
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
