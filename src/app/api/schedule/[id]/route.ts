/**
 * 单个定时任务操作 API
 *
 * PATCH   /api/schedule/[id]    更新任务（启停 / 调度时间 / 报告类型）
 * DELETE  /api/schedule/[id]    删除任务
 *
 * 请求体（PATCH）：
 *   { enabled?: boolean, schedule?: string, reportType?: string, plugin?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseSchedule, isValidCron } from "@/lib/scheduler";
import { startScheduledTask, stopScheduledTask } from "@/lib/scheduler-runner";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const { id } = params;

  // 确认任务归属当前用户
  const task = await prisma.scheduledTask.findFirst({
    where: { id, userId: user.id },
  });
  if (!task) {
    return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  }

  const body = (await req.json()) as {
    enabled?: boolean;
    schedule?: string;
    reportType?: string;
    plugin?: string;
  };

  // 构建更新数据
  const updateData: Record<string, unknown> = {};

  if (typeof body.enabled === "boolean") {
    updateData.enabled = body.enabled;
  }

  if (body.schedule !== undefined) {
    const schedule = body.schedule.trim();
    if (!schedule) {
      return NextResponse.json({ error: "调度时间不能为空" }, { status: 400 });
    }
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
    updateData.schedule = schedule;
    updateData.cronExpr = cronExpr;
  }

  if (body.reportType !== undefined) {
    if (!["daily", "weekly", "monthly"].includes(body.reportType)) {
      return NextResponse.json({ error: "报告类型无效" }, { status: 400 });
    }
    updateData.reportType = body.reportType;
  }

  if (body.plugin !== undefined) {
    updateData.plugin = body.plugin.trim() || null;
  }

  // 更新 DB
  const updated = await prisma.scheduledTask.update({
    where: { id },
    data: updateData,
  });

  // 同步到 cron 调度器
  stopScheduledTask(id);
  if (updated.enabled) {
    startScheduledTask({
      id: updated.id,
      name: updated.name,
      cronExpr: updated.cronExpr,
      reportType: updated.reportType,
      plugin: updated.plugin,
      userId: updated.userId,
    });
  }

  return NextResponse.json({ task: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const { id } = params;

  // 确认任务归属当前用户
  const task = await prisma.scheduledTask.findFirst({
    where: { id, userId: user.id },
  });
  if (!task) {
    return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  }

  // 停止 cron + 删除 DB
  stopScheduledTask(id);
  await prisma.scheduledTask.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
