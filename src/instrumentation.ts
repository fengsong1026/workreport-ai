/**
 * Next.js Instrumentation — 服务器启动时执行一次
 *
 * 加载 DB 中所有已启用的定时任务，注册到 node-cron 调度器。
 * 文件位置：src/instrumentation.ts（Next.js 约定）
 */

export async function register() {
  // 仅在 Node.js 运行时执行（排除 Edge / 构建阶段）
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { loadAndStartAllTasks } = await import("./lib/scheduler-runner");

  try {
    await loadAndStartAllTasks();
  } catch (e) {
    console.error("[instrumentation] 加载定时任务失败:", e instanceof Error ? e.message : String(e));
  }
}
