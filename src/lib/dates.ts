/**
 * 日期/周数工具：计算 ISO 周区间、日报/周报/月报的时间范围
 */

import { TimeRange } from "./models";

/**
 * 返回今天 00:00:00 UTC 的 Date 对象
 */
function today(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * 返回某 ISO 周的时间范围
 *
 * @param week 周号；undefined → 当前周（本周一 ~ 今天 23:59:59）
 * @param year 年份；undefined → 当前年
 */
export function getWeekRange(week?: number, year?: number): TimeRange {
  const now = new Date();
  let monday: Date;
  let end: Date;

  if (week === undefined) {
    // 当前周：本周一 ~ 今天 23:59:59
    const t = today();
    const dayOfWeek = t.getUTCDay(); // 0=Sun, 1=Mon, ...
    const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 回到周一
    monday = new Date(t);
    monday.setUTCDate(t.getUTCDate() + offset);
    end = new Date(t);
    end.setUTCHours(23, 59, 59, 999);
  } else {
    // 指定周：完整范围（周一 ~ 周日 23:59:59）
    const y = year ?? now.getUTCFullYear();
    // 1月4日总是第1周
    const jan4 = new Date(Date.UTC(y, 0, 4));
    const jan4Day = jan4.getUTCDay();
    const mondayWeek1 = new Date(jan4);
    mondayWeek1.setUTCDate(
      jan4.getUTCDate() + (jan4Day === 0 ? -6 : 1 - jan4Day),
    );
    monday = new Date(mondayWeek1);
    monday.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);
    end = new Date(monday);
    end.setUTCDate(monday.getUTCDate() + 6);
    end.setUTCHours(23, 59, 59, 999);
  }

  const iso = isoWeek(monday);
  const label = `W${iso.week.toString().padStart(2, "0")} (${iso.year})`;
  return new TimeRange(monday, end, label);
}

/**
 * 返回某一天的范围（00:00 ~ 23:59:59）
 * @param day 指定日期；undefined → 今天
 */
export function getDayRange(day?: Date): TimeRange {
  const d = day ?? today();
  const start = new Date(d);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setUTCHours(23, 59, 59, 999);
  const label = d.toISOString().slice(0, 10);
  return new TimeRange(start, end, label);
}

/**
 * 返回某月的时间范围
 * @param month 月份；undefined → 当前月
 * @param year 年份；undefined → 当前年
 */
export function getMonthRange(month?: number, year?: number): TimeRange {
  const now = new Date();
  const m = month ?? now.getUTCMonth() + 1;
  const y = year ?? now.getUTCFullYear();
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  const label = `${y}-${m.toString().padStart(2, "0")}`;
  return new TimeRange(start, end, label);
}

/**
 * 根据报告类型返回对应时间范围
 */
export function getRange(
  reportType: "daily" | "weekly" | "monthly",
  opts: { week?: number; year?: number; month?: number } = {},
): TimeRange {
  if (reportType === "daily") return getDayRange();
  if (reportType === "monthly") return getMonthRange(opts.month, opts.year);
  return getWeekRange(opts.week, opts.year);
}

/**
 * 计算某日期所属 ISO 周
 */
export function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}
