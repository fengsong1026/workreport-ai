/**
 * 定时任务管理 API
 *
 * GET  /api/schedule        列出当前用户的所有定时任务
 * POST /api/schedule        创建新的定时任务
 *
 * 请求体（POST）：
 *   { name: "周五周报", schedule: "Fri 17:00", reportType: "weekly", plugin?: "git" }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseSchedule, isValidCron } from "@/lib/scheduler";
import { startScheduledTask } from "@/lib/scheduler-runner";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const tasks = await prisma.scheduledTask.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      schedule: true,
      cronExpr: true,
      reportType: true,
      enabled: true,
      plugin: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const body = (await req.json()) as {
    name?: string;
    schedule?: string;
    reportType?: string;
    plugin?: string;
  };

  // 校验
  const name = body.name?.trim();
  const schedule = body.schedule?.trim();
  const reportType = (body.reportType || "weekly") as "daily" | "weekly" | "monthly";

  if (!name) {
    return NextResponse.json({ error: "任务名称不能为空" }, { status: 400 });
  }
  if (!schedule) {
    return NextResponse.json({ error: "调度时间不能为空" }, { status: 400 });
  }
  if (!["daily", "weekly", "monthly"].includes(reportType)) {
    return NextResponse.json({ error: "报告类型无效" }, { status: 400 });
  }

  // 解析 schedule → cron
  let cronExpr: string;
  try {
    cronExpr = parseSchedule(schedule);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "调度时间格式错误" },
      { status: 400 },
    );
  }

  if (!isValidCron(cronExpr)) {
    return NextResponse.json({ error: `无效的 cron 表达式: ${cronExpr}` }, { status: 400 });
  }

  // 检查名称唯一性
  const existing = await prisma.scheduledTask.findUnique({
    where: { userId_name: { userId: user.id, name } },
  });
  if (existing) {
    return NextResponse.json({ error: "任务名称已存在" }, { status: 409 });
  }

  // 保存到 DB
  const task = await prisma.scheduledTask.create({
    data: {
      name,
      schedule,
      cronExpr,
      reportType,
      enabled: true,
      plugin: body.plugin?.trim() || null,
      userId: user.id,
    },
  });

  // 注册到 cron 调度器
  startScheduledTask({
    id: task.id,
    name: task.name,
    cronExpr: task.cronExpr,
    reportType: task.reportType,
    plugin: task.plugin,
    userId: task.userId,
  });

  console.log(`[调度] 用户 ${user.email} 创建任务 "${name}" — ${schedule} (${cronExpr})`);

  return NextResponse.json({ task }, { status: 201 });
}
