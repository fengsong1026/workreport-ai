/**
 * Git 数据源插件 —— 通过 GitHub OAuth + API 获取提交记录
 *
 * 数据流：
 *   1. 用户在 Web UI 点击"连接 GitHub"→ OAuth 授权 → token 存入 DB
 *   2. collect()  通过 GitHub API 拉取用户仓库列表，存入 DB 供用户选择
 *   3. read()     对用户选中的仓库调用 GitHub Commits API，返回 WorkRecord
 *   4. formatForPrompt()  按仓库分组格式化
 *
 * 零本地依赖：不需要 git、不需要 Python、不需要本地仓库。
 */

import { PluginMeta, WorkRecord } from "@/lib/models";
import { CollectArgs, DataSourcePlugin, defaultStats } from "@/lib/plugin";
import { prisma } from "@/lib/prisma";
import {
  listCommits,
  listUserRepos,
  type GitHubRepo,
} from "@/lib/github";

const MAX_RECORDS_FOR_PROMPT = 300;

/**
 * DataSource.config 中存储的 JSON 结构
 */
interface GitDataSourceConfig {
  token: string;
  user: { login: string; name: string | null; email: string | null };
  repos: Array<{ id: number; fullName: string; selected: boolean }>;
}

export class GitPlugin implements DataSourcePlugin {
  readonly meta = new PluginMeta(
    "git",
    "Git (GitHub)",
    "GitHub 提交记录",
    "程序员 / 技术研究员",
    "done",
  );

  constructor(
    private _projectDir: string,
    private _config: Record<string, unknown> = {},
  ) {}

  /**
   * 从 DB 读取 GitHub 连接配置
   */
  private async loadConfig(): Promise<GitDataSourceConfig | null> {
    const row = await prisma.dataSource.findUnique({ where: { name: "git" } });
    if (!row || !row.connected) return null;
    try {
      return JSON.parse(row.config) as GitDataSourceConfig;
    } catch {
      return null;
    }
  }

  /**
   * 采集：通过 GitHub API 拉取用户仓库列表，存入 DB
   *
   * @returns 仓库数量
   */
  async collect(_args: CollectArgs): Promise<number> {
    const cfg = await this.loadConfig();
    if (!cfg) {
      throw new Error("GitHub 未连接，请先在数据源页面点击「连接 GitHub」。");
    }

    console.log(`[*] 从 GitHub API 拉取 ${cfg.user.login} 的仓库列表...`);
    const repos = await listUserRepos(cfg.token);

    // 保留用户之前的选择状态
    const prevSelected = new Set(
      cfg.repos.filter((r) => r.selected).map((r) => r.id),
    );

    const newRepos = repos.map((r: GitHubRepo) => ({
      id: r.id,
      fullName: r.fullName,
      selected: prevSelected.has(r.id),
    }));

    const updatedConfig: GitDataSourceConfig = {
      ...cfg,
      repos: newRepos,
    };

    await prisma.dataSource.update({
      where: { name: "git" },
      data: { config: JSON.stringify(updatedConfig) },
    });

    console.log(`[*] 同步完成，共 ${newRepos.length} 个仓库`);
    return newRepos.length;
  }

  /**
   * 读取：对选中的仓库调用 GitHub Commits API
   */
  async read(since: Date, until: Date, email?: string): Promise<WorkRecord[]> {
    const cfg = await this.loadConfig();
    if (!cfg) {
      console.error("[!] GitHub 未连接，无法读取提交记录。");
      return [];
    }

    const selectedRepos = cfg.repos.filter((r) => r.selected);
    if (selectedRepos.length === 0) {
      console.error("[!] 未选择任何仓库，请在数据源页面选择要纳入报告的仓库。");
      return [];
    }

    // email 定义时按 email 或 login 过滤（客户端），否则返回所有作者
    const records: WorkRecord[] = [];

    for (const repo of selectedRepos) {
      const [owner, repoName] = repo.fullName.split("/", 2);
      if (!owner || !repoName) continue;

      try {
        const commits = await listCommits(
          cfg.token,
          owner,
          repoName,
          since,
          until,
        );

        for (const c of commits) {
          // 客户端过滤：匹配 email 或 GitHub login
          if (email && c.authorEmail !== email && c.authorLogin !== email) continue;

          const subject = c.message
            ? c.message.split("\n", 1)[0]
            : "(no message)";

          records.push({
            source: "git",
            timestamp: c.authorDate,
            title: subject,
            detail: c.message,
            project: repo.fullName,
            author: c.authorName,
            email: c.authorEmail,
            raw: {
              sha: c.sha,
              login: c.authorLogin,
              html_url: c.htmlUrl,
            },
          });
        }
      } catch (e) {
        console.error(`[!] 获取 ${repo.fullName} 提交失败:`, e);
      }
    }

    records.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    return records;
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
        const sha = ((r.raw?.sha as string) || "").slice(0, 7);
        lines.push(`- [${ts}] [#${sha}] ${author}: ${r.title}`);
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
