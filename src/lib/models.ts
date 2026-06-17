/**
 * 共享数据模型与类型定义
 */

/**
 * 统一工作记录格式
 *
 * 每个插件在 read() 中返回此格式的对象列表，便于跨插件聚合生成汇报。
 * 插件可在 `raw` 字段中保留各自的原始数据（如 git 的 hash/branch）。
 */
export interface WorkRecord {
  /** 数据源插件名 ("git" | "task" | "calendar" | "doc") */
  source: string;
  /** ISO 8601 时间戳 */
  timestamp: string;
  /** 简短摘要（提交主题 / 任务标题 / 日程摘要 / 文档标题） */
  title: string;
  /** 完整详情（提交正文 / 任务描述 等） */
  detail: string;
  /** 所属项目（仓库名 / 项目名 / 日历名 / 文档空间） */
  project: string;
  /** 执行人姓名 */
  author: string;
  /** 执行人邮箱（可选） */
  email?: string;
  /** 插件专属原始数据（可选） */
  raw?: Record<string, unknown>;
}

/**
 * 插件元数据
 */
export class PluginMeta {
  constructor(
    public readonly name: string,
    public readonly displayName: string,
    public readonly dataSource: string,
    public readonly targetUsers: string,
    public readonly status: "done" | "planned",
  ) {}

  get isAvailable(): boolean {
    return this.status === "done";
  }

  asDict(): Record<string, string> {
    return {
      name: this.name,
      display_name: this.displayName,
      data_source: this.dataSource,
      target_users: this.targetUsers,
      status: this.status,
    };
  }
}

/**
 * 时间范围 [start, end]，包含 ISO 周标签
 */
export class TimeRange {
  constructor(
    public readonly start: Date,
    public readonly end: Date,
    public readonly label: string,
  ) {}

  get dateRangeStr(): string {
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    return `${fmt(this.start)} → ${fmt(this.end)}`;
  }
}
