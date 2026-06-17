/**
 * Git 数据源插件 —— 路径引用 git-weekly-automation 子应用
 *
 * 本插件不复制 git-weekly-automation 的代码，而是通过 config 中配置的 `path`
 * 指向同级目录下的 git-weekly-automation 项目：
 *   - collect() 委托执行其 scripts/collect-commits 采集器
 *   - read()    直接读取其 data/commits/*.jsonl（格式稳定、文档化）
 *   - formatForPrompt() 在平台侧实现按仓库分组格式化
 *
 * 全局 Git Hook 的安装仍由 git-weekly-automation/scripts/setup 负责。
 */

import { execFile } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join, resolve, isAbsolute } from "path";
import { PluginMeta, WorkRecord } from "@/lib/models";
import { CollectArgs, DataSourcePlugin, defaultStats } from "@/lib/plugin";

const MAX_RECORDS_FOR_PROMPT = 300;

export class GitPlugin implements DataSourcePlugin {
  readonly meta = new PluginMeta(
    "git",
    "Git Weekly Automation",
    "Git 提交记录",
    "程序员 / 技术研究员",
    "done",
  );

  constructor(
    private projectDir: string,
    private config: Record<string, unknown> = {},
  ) {}

  /** git-weekly-automation 项目根目录 */
  get gitProjectDir(): string {
    const raw = (this.config.path as string) || "../git-weekly-automation";
    return isAbsolute(raw) ? raw : resolve(this.projectDir, raw);
  }

  get commitsDir(): string {
    return join(this.gitProjectDir, "data", "commits");
  }

  get collectScript(): string {
    return join(this.gitProjectDir, "scripts", "collect-commits");
  }

  /**
   * 采集：委托给 git-weekly-automation/scripts/collect-commits
   */
  async collect(args: CollectArgs): Promise<number> {
    if (!existsSync(this.collectScript)) {
      console.error(
        `[!] 未找到 git-weekly-automation 采集器: ${this.collectScript}\n` +
          `    请检查 config.json 中 plugins.git.path 配置。`,
      );
      return 0;
    }

    const cmdArgs: string[] = [];
    for (const s of args.scan || []) cmdArgs.push("--scan", s);
    if (args.since) cmdArgs.push("--since", args.since);
    if (args.until) cmdArgs.push("--until", args.until);
    if (args.author) cmdArgs.push("--author", args.author);
    if (args.allAuthors) cmdArgs.push("--all-authors");
    if (args.dryRun) cmdArgs.push("--dry-run");
    if (args.maxDepth) cmdArgs.push("--max-depth", String(args.maxDepth));

    console.log(`[*] 委托 git-weekly-automation 采集器: ${this.gitProjectDir}`);

    return new Promise((resolvePromise) => {
      execFile("python3", [this.collectScript, ...cmdArgs], (error, stdout, stderr) => {
        if (stdout) process.stdout.write(stdout);
        if (stderr) process.stderr.write(stderr);
        if (error) {
          console.error(`[!] 采集器执行失败: ${error.message}`);
        }
        resolvePromise(error ? 0 : 0);
      });
    });
  }

  /**
   * 读取：直接读取 data/commits/*.jsonl，归一化为 WorkRecord
   */
  async read(since: Date, until: Date, email?: string): Promise<WorkRecord[]> {
    const records: WorkRecord[] = [];

    if (!existsSync(this.commitsDir)) {
      console.error(
        `[!] 未找到提交数据目录: ${this.commitsDir}\n` +
          `    请先在 git-weekly-automation 中运行 ./scripts/setup 安装 Hook，\n` +
          `    或执行 collect 采集历史记录。`,
      );
      return records;
    }

    // 遍历区间内可能涉及的周文件
    const seenWeeks = new Set<string>();
    const cur = new Date(since);
    while (cur.getTime() <= until.getTime()) {
      const isoYear = cur.getUTCFullYear();
      const isoWeekNum = isoWeek(cur);
      const weekKey = `${isoYear}-W${isoWeekNum.toString().padStart(2, "0")}`;
      if (!seenWeeks.has(weekKey)) {
        seenWeeks.add(weekKey);
        const weekFile = join(this.commitsDir, `${weekKey}.jsonl`);
        if (existsSync(weekFile)) {
          records.push(...this.readFile(weekFile, since, until, email));
        }
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    records.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    return records;
  }

  private readFile(
    path: string,
    since: Date,
    until: Date,
    email?: string,
  ): WorkRecord[] {
    const out: WorkRecord[] = [];
    try {
      const content = readFileSync(path, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let entry: Record<string, unknown>;
        try {
          entry = JSON.parse(trimmed);
        } catch {
          continue;
        }

        const tsStr = entry.timestamp as string | undefined;
        if (!tsStr) continue;
        const ts = new Date(tsStr);
        if (isNaN(ts.getTime())) continue;
        if (!(since.getTime() <= ts.getTime() && ts.getTime() <= until.getTime())) continue;
        if (email && (entry.email as string) !== email) continue;

        const message = ((entry.message as string) || "").trim();
        const subject = message ? message.split("\n", 1)[0] : "(no message)";
        out.push({
          source: "git",
          timestamp: tsStr,
          title: subject,
          detail: message,
          project: (entry.repo as string) || "unknown",
          author: (entry.author as string) || "",
          email: (entry.email as string) || "",
          raw: entry,
        });
      }
    } catch (e) {
      console.error(`[!] 读取 ${path} 失败:`, e);
    }
    return out;
  }

  /**
   * 格式化：按仓库分组
   */
  formatForPrompt(records: WorkRecord[]): string {
    const total = records.length;
    const truncated = total > MAX_RECORDS_FOR_PROMPT;
    const display = truncated ? records.slice(0, MAX_RECORDS_FOR_PROMPT) : records;

    const grouped = new Map<string, WorkRecord[]>();
    for (const r of display) {
      const key = r.project || "unknown";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(r);
    }

    // 按提交数降序
    const sorted = Array.from(grouped.entries()).sort(
      (a, b) => b[1].length - a[1].length,
    );

    const lines: string[] = [];
    for (const [repo, repoRecords] of sorted) {
      lines.push(`\n### ${repo} (${repoRecords.length} commits)`);
      for (const r of repoRecords) {
        const ts = r.timestamp.slice(0, 10);
        const author = r.author || "?";
        const branch = ((r.raw?.branch as string) || "?");
        lines.push(`- [${ts}] [${branch}] ${author}: ${r.title}`);
      }
    }

    let output = lines.join("\n");
    if (truncated) {
      output += `\n\n> ⚠️ **注意:** 另有 ${total - MAX_RECORDS_FOR_PROMPT} 条记录因数量过多被省略。`;
    }
    return output;
  }

  stats(records: WorkRecord[]): { count: number; projectCount: number } {
    return defaultStats(records);
  }
}

/**
 * 计算某日期所属 ISO 周
 */
function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
