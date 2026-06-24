/**
 * 数据源插件接口
 *
 * 每类岗位对应一个 DataSourcePlugin 实现：
 *   - collect()           从数据源采集原始记录
 *   - read()              读取指定时间区间内的记录
 *   - formatForPrompt()   将记录格式化为 AI prompt 友好的文本
 *   - stats()             返回记录数 / 项目数等统计信息
 *
 * 所有插件共享同一 AI 生成引擎（ai-engine.ts），插件只负责"数据侧"。
 */

import type { WorkRecord, PluginMeta } from "./models";

/**
 * 采集参数（各插件自定义扩展）
 */
export interface CollectArgs {
  /** 扫描目录列表 */
  scan: string[];
  /** 起始日期 YYYY-MM-DD */
  since?: string;
  /** 截止日期 YYYY-MM-DD */
  until?: string;
  /** 仅采集该作者（邮箱） */
  author?: string;
  /** 采集所有作者 */
  allAuthors: boolean;
  /** 预览不写入 */
  dryRun: boolean;
  /** 扫描深度 */
  maxDepth?: number;
  /** 当前登录用户 ID（用于按用户隔离数据源配置） */
  userId?: string;
}

/**
 * 数据源插件接口
 */
export interface DataSourcePlugin {
  /** 插件元数据 */
  readonly meta: PluginMeta;

  /**
   * 从数据源采集记录
   * @returns 新采集到的记录数
   */
  collect(args: CollectArgs): Promise<number>;

  /**
   * 读取 [since, until] 时间区间内的记录
   * @param email 若提供，仅返回该作者（邮箱）的记录
   * @param userId 当前登录用户 ID（用于按用户隔离数据源配置）
   * @returns WorkRecord 列表，按时间升序
   */
  read(since: Date, until: Date, email?: string, userId?: string): Promise<WorkRecord[]>;

  /**
   * 将记录格式化为 AI prompt 友好的文本（按项目分组等）
   */
  formatForPrompt(records: WorkRecord[]): string;

  /**
   * 返回统计信息，用于模板占位符
   */
  stats(records: WorkRecord[]): { count: number; projectCount: number };
}

/**
 * 默认 stats 实现，子类可覆盖
 */
export function defaultStats(records: WorkRecord[]): {
  count: number;
  projectCount: number;
} {
  const projects = new Set(records.map((r) => r.project || "unknown"));
  return {
    count: records.length,
    projectCount: projects.size,
  };
}
