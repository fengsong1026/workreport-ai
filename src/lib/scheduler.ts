/**
 * 任务调度器：基于 node-cron 管理定时报告生成任务
 *
 * 任务配置存储在 SQLite（通过 Prisma），运行时在 Node.js 进程内调度。
 *
 * Schedule 表达式（人类可读）：
 *   "Mon 09:00"          每周一 9 点
 *   "Fri 17:00"          每周五 17 点
 *   "Mon,Wed,Fri 14:00"  每周一/三/五 14 点
 *   "weekday 08:00"      周一至周五 8 点
 *   "daily 08:00"        每天 8 点
 */

import cron from "node-cron";

const DAY_MAP: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

const REV_MAP: Record<number, string> = {
  0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat",
};

/**
 * 将人类可读的 schedule 字符串解析为 cron 表达式
 *
 * @example "Fri 17:00" → "0 17 * * 5"
 * @example "Mon,Wed,Fri 14:00" → "0 14 * * 1,3,5"
 * @example "weekday 08:00" → "0 8 * * 1-5"
 * @example "daily 08:00" → "0 8 * * *"
 * @example "1,15 10:00" → "0 10 1,15 * *"
 */
export function parseSchedule(scheduleStr: string): string {
  const s = scheduleStr.trim().toLowerCase();
  const timeMatch = s.match(/(\d{1,2}):(\d{2})\s*$/);
  if (!timeMatch) {
    throw new Error(`无效的 schedule: ${JSON.stringify(scheduleStr)}，期望形如 'Fri 17:00'`);
  }
  const hour = parseInt(timeMatch[1], 10);
  const minute = parseInt(timeMatch[2], 10);
  const dayPart = s.slice(0, timeMatch.index).trim().replace(/,$/, "").trim();

  if (hour < 0 || hour > 23) throw new Error(`小时必须在 0-23，得到: ${hour}`);
  if (minute < 0 || minute > 59) throw new Error(`分钟必须在 0-59，得到: ${minute}`);

  // 每天
  if (!dayPart || ["daily", "everyday", "every day"].includes(dayPart)) {
    return `${minute} ${hour} * * *`;
  }

  // 工作日
  if (["weekday", "weekdays", "week day"].includes(dayPart)) {
    return `${minute} ${hour} * * 1-5`;
  }

  // 周末
  if (["weekend", "weekends"].includes(dayPart)) {
    return `${minute} ${hour} * * 0,6`;
  }

  // 数字日（每月几号）
  if (/^[\d,\s]+$/.test(dayPart)) {
    const days = dayPart.split(",").map((d) => parseInt(d.trim(), 10)).filter((d) => !isNaN(d));
    if (days.every((d) => d >= 1 && d <= 31)) {
      return `${minute} ${hour} ${days.join(",")} * *`;
    }
    throw new Error(`无效的日期: ${dayPart}`);
  }

  // 星期名
  const parts = dayPart.split(",").map((p) => p.trim());
  const weekdays: number[] = [];
  for (const p of parts) {
    if (p.includes("-")) {
      const [start, end] = p.split("-", 2).map((s) => s.trim());
      const s = DAY_MAP[start];
      const e = DAY_MAP[end];
      if (s === undefined || e === undefined) {
        throw new Error(`无效的星期范围: ${p}`);
      }
      if (e >= s) {
        for (let i = s; i <= e; i++) weekdays.push(i);
      } else {
        // 跨周（如 Fri-Mon）
        for (let i = s; i < 7; i++) weekdays.push(i);
        for (let i = 0; i <= e; i++) weekdays.push(i);
      }
    } else {
      const d = DAY_MAP[p];
      if (d === undefined) {
        throw new Error(`无效的星期: ${p}，可用 Mon/Tue/Wed/Thu/Fri/Sat/Sun`);
      }
      weekdays.push(d);
    }
  }

  const uniqueDays = [...new Set(weekdays)].sort((a, b) => a - b);
  // cron 中 0=Sunday，转换为 cron 的 7 表示周日
  const cronDays = uniqueDays.map((d) => (d === 0 ? 0 : d)).join(",");
  return `${minute} ${hour} * * ${cronDays}`;
}

/**
 * 将 cron 表达式转为人类可读字符串（简化版）
 */
export function cronToString(cronExpr: string): string {
  const parts = cronExpr.split(/\s+/);
  if (parts.length !== 5) return cronExpr;
  const [minute, hour, , , dayOfWeek] = parts;
  const time = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;

  if (dayOfWeek === "*") return `每天 ${time}`;
  if (dayOfWeek === "1-5") return `工作日 ${time}`;
  if (dayOfWeek === "0,6") return `周末 ${time}`;

  // 解析星期列表
  const days = dayOfWeek.split(",").map((d) => {
    const n = parseInt(d, 10);
    return REV_MAP[n] ?? d;
  });
  return `${days.join(",")} ${time}`;
}

/**
 * 验证 cron 表达式是否有效
 */
export function isValidCron(cronExpr: string): boolean {
  return cron.validate(cronExpr);
}

/**
 * 调度器单例：管理所有运行中的定时任务
 */
class Scheduler {
  private jobs = new Map<string, cron.ScheduledTask>();

  /**
   * 启动一个定时任务
   * @param name 任务名
   * @param cronExpr cron 表达式
   * @param handler 执行函数
   */
  start(name: string, cronExpr: string, handler: () => void | Promise<void>): void {
    this.stop(name);
    if (!cron.validate(cronExpr)) {
      throw new Error(`无效的 cron 表达式: ${cronExpr}`);
    }
    const task = cron.schedule(cronExpr, handler, {
      timezone: process.env.TZ || "Asia/Shanghai",
    });
    this.jobs.set(name, task);
  }

  /**
   * 停止一个定时任务
   */
  stop(name: string): void {
    const task = this.jobs.get(name);
    if (task) {
      task.stop();
      this.jobs.delete(name);
    }
  }

  /**
   * 停止所有任务
   */
  stopAll(): void {
    for (const task of this.jobs.values()) {
      task.stop();
    }
    this.jobs.clear();
  }

  /**
   * 列出所有运行中的任务名
   */
  running(): string[] {
    return Array.from(this.jobs.keys());
  }
}

export const scheduler = new Scheduler();
