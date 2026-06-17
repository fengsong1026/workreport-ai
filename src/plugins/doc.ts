/**
 * Doc Reporter 插件 —— 文档数据源（规划中）
 *
 * 数据源：Notion / 语雀 / Confluence
 * 目标用户：内容 / 运营
 */

import { PluginMeta, WorkRecord } from "@/lib/models";
import { CollectArgs, DataSourcePlugin, defaultStats } from "@/lib/plugin";

export class DocPlugin implements DataSourcePlugin {
  readonly meta = new PluginMeta(
    "doc",
    "Doc Reporter",
    "Notion / 语雀 / Confluence",
    "内容 / 运营",
    "planned",
  );

  constructor(
    private projectDir: string,
    private config: Record<string, unknown> = {},
  ) {}

  async collect(_args: CollectArgs): Promise<number> {
    throw new Error(
      "Doc Reporter 尚在规划中。将对接 Notion / 语雀 / Confluence API 采集文档编辑记录。",
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
