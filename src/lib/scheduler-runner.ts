/**
 * 调度任务运行器：连接 DB 任务 ↔ node-cron ↔ 生成逻辑
 *
 * - startScheduledTask(task): 注册单个任务到 cron
 * - stopScheduledTask(taskId): 停止单个任务
 * - loadAndStartAllTasks(): 服务器启动时加载所有已启用的任务
 */

import { scheduler } from "./scheduler";
import { generateReportForUser } from "./generate";
import { prisma } from "./prisma";

type ReportType = "daily" | "weekly" | "monthly";

interface TaskInfo {
  id: string;
  name: string;
  cronExpr: string;
  reportType: string;
  plugin: string | null;
  userId: string;
}

/**
 * 注册单个定时任务到 cron 调度器
 */
export function startScheduledTask(task: TaskInfo): void {
  const reportType = task.reportType as ReportType;

  scheduler.start(task.id, task.cronExpr, async () => {
    console.log(`[调度] 触发任务 "${task.name}" (${task.id}) — ${new Date().toISOString()}`);

    try {
      const result = await generateReportForUser(task.userId, {
        type: reportType,
        plugin: task.plugin || undefined,
        allAuthors: true,
      });

      if (result.success) {
        console.log(
          `[调度] 任务 "${task.name}" 生成成功 — ${result.stats.recordCount} 条记录, 报告ID: ${result.reportId}`,
        );
      } else {
        console.error(`[调度] 任务 "${task.name}" 生成失败: ${result.error}`);
      }
    } catch (e) {
      console.error(
        `[调度] 任务 "${task.name}" 执行异常:`,
        e instanceof Error ? e.message : String(e),
      );
    }
  });
}

/**
 * 停止单个定时任务
 */
export function stopScheduledTask(taskId: string): void {
  scheduler.stop(taskId);
}

/**
 * 服务器启动时加载所有已启用的定时任务
 *
 * 在 instrumentation.ts 的 register() 中调用。
 */
export async function loadAndStartAllTasks(): Promise<number> {
  const tasks = await prisma.scheduledTask.findMany({
    where: { enabled: true },
  });

  for (const task of tasks) {
    try {
      startScheduledTask({
        id: task.id,
        name: task.name,
        cronExpr: task.cronExpr,
        reportType: task.reportType,
        plugin: task.plugin,
        userId: task.userId,
      });
    } catch (e) {
      console.error(`[调度] 加载任务 "${task.name}" 失败:`, e instanceof Error ? e.message : String(e));
    }
  }

  if (tasks.length > 0) {
    console.log(`[调度] 已加载 ${tasks.length} 个定时任务`);
  }

  return tasks.length;
}
