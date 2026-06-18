/**
 * JSONL 存储工具：供没有自带存储的插件使用
 *
 * GitPlugin 通过 GitHub API 实时获取数据，不使用本模块。
 * 规划中的 Task / Calendar / Doc 插件落地后可基于本模块
 * 将自己的数据写入 data/sources/<plugin>/YYYY-WXX.jsonl。
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { isoWeek } from "./dates";

/**
 * 返回某插件的存储目录：data/sources/<pluginName>/
 */
export function sourceDir(projectDir: string, pluginName: string): string {
  return join(projectDir, "data", "sources", pluginName);
}

/**
 * 返回某时间所属 ISO 周的 JSONL 文件路径
 */
export function weekFile(projectDir: string, pluginName: string, dt: Date): string {
  const iso = isoWeek(dt);
  return join(sourceDir(projectDir, pluginName), `${iso.year}-W${iso.week.toString().padStart(2, "0")}.jsonl`);
}

/**
 * 将记录追加到对应周的 JSONL 文件，按 dedupField 去重
 * @returns 写入的记录数
 */
export function appendRecords(
  projectDir: string,
  pluginName: string,
  records: Iterable<Record<string, unknown>>,
  dedupField = "id",
): number {
  let written = 0;
  const byWeek = new Map<string, { path: string; items: Record<string, unknown>[] }>();

  for (const r of records) {
    const ts = r.timestamp as string | undefined;
    if (!ts) continue;
    const dt = new Date(ts);
    if (isNaN(dt.getTime())) continue;
    const path = weekFile(projectDir, pluginName, dt);
    if (!byWeek.has(path)) byWeek.set(path, { path, items: [] });
    byWeek.get(path)!.items.push(r);
  }

  for (const { path, items } of byWeek.values()) {
    mkdirSync(dirname(path), { recursive: true });
    const existing = loadHashes(path, dedupField);
    for (const r of items) {
      const key = r[dedupField] as string | undefined;
      if (key && existing.has(key)) continue;
      appendFileSync(path, JSON.stringify(r) + "\n", "utf-8");
      if (key) existing.add(key);
      written++;
    }
  }
  return written;
}

/**
 * 读取一个 JSONL 文件中已存在的去重字段值集合
 */
export function loadHashes(path: string, dedupField: string): Set<string> {
  const hashes = new Set<string>();
  if (!existsSync(path)) return hashes;
  try {
    const content = readFileSync(path, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const val = (JSON.parse(trimmed) as Record<string, unknown>)[dedupField] as
          | string
          | undefined;
        if (val) hashes.add(val);
      } catch {
        continue;
      }
    }
  } catch {
    // 文件读取失败，忽略
  }
  return hashes;
}

/**
 * 读取 [since, until] 区间内的所有记录，按时间升序
 */
export function readRange(
  projectDir: string,
  pluginName: string,
  since: Date,
  until: Date,
): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  const sdir = sourceDir(projectDir, pluginName);
  if (!existsSync(sdir)) return records;

  // 遍历区间内可能涉及的周文件
  const seenWeeks = new Set<string>();
  const cur = new Date(since);
  // 按天遍历，避免跨周边界遗漏
  while (cur.getTime() <= until.getTime()) {
    const iso = isoWeek(cur);
    const weekKey = `${iso.year}-W${iso.week.toString().padStart(2, "0")}`;
    if (!seenWeeks.has(weekKey)) {
      seenWeeks.add(weekKey);
      const path = join(sdir, `${weekKey}.jsonl`);
      if (existsSync(path)) {
        try {
          const content = readFileSync(path, "utf-8");
          for (const line of content.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const rec = JSON.parse(trimmed) as Record<string, unknown>;
              const tsStr = rec.timestamp as string | undefined;
              if (!tsStr) continue;
              const ts = new Date(tsStr);
              if (isNaN(ts.getTime())) continue;
              if (since.getTime() <= ts.getTime() && ts.getTime() <= until.getTime()) {
                records.push(rec);
              }
            } catch {
              continue;
            }
          }
        } catch {
          continue;
        }
      }
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  records.sort((a, b) => {
    const ta = (a.timestamp as string) || "";
    const tb = (b.timestamp as string) || "";
    return ta.localeCompare(tb);
  });
  return records;
}
