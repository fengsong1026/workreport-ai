/**
 * 单个定时任务操作 API
 * PATCH  /api/schedule/[id]   更新任务（启停 / 调度时间 / 报告类型）
 * DELETE /api/schedule/[id]   删除任务
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseSchedule, isValidCron } from "@/lib/scheduler";
import { startScheduledTask, stopScheduledTask } from "@/lib/scheduler-runner";
import { ScheduleUpdateSchema, parseBody } from "@/lib/schemas";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const { id } = params;
  const task = await prisma.scheduledTask.findFirst({ where: { id, userId: user.id } });
  if (!task) {
    return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }

  const parsed = parseBody(ScheduleUpdateSchema, body);
  if (!parsed.success) return parsed.response;

  const updateData: Record<string, unknown> = {};

  if (typeof parsed.data.enabled === "boolean") updateData.enabled = parsed.data.enabled;

  if (parsed.data.schedule !== undefined) {
    const schedule = parsed.data.schedule.trim();
    if (!schedule) return NextResponse.json({ error: "调度时间不能为空" }, { status: 400 });
    try {
      const cronExpr = parseSchedule(schedule);
      if (!isValidCron(cronExpr)) return NextResponse.json({ error: `无效的 cron 表达式: ${cronExpr}` }, { status: 400 });
      updateData.schedule = schedule;
      updateData.cronExpr = cronExpr;
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "调度时间格式错误" }, { status: 400 });
    }
  }

  if (parsed.data.reportType !== undefined) updateData.reportType = parsed.data.reportType;
  if (parsed.data.plugin !== undefined) updateData.plugin = parsed.data.plugin.trim() || null;

  const updated = await prisma.scheduledTask.update({ where: { id }, data: updateData });

  stopScheduledTask(id);
  if (updated.enabled) {
    startScheduledTask({
      id: updated.id, name: updated.name, cronExpr: updated.cronExpr,
      reportType: updated.reportType, plugin: updated.plugin, userId: updated.userId,
    });
  }

  return NextResponse.json({ task: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const { id } = params;
  const task = await prisma.scheduledTask.findFirst({ where: { id, userId: user.id } });
  if (!task) {
    return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  }

  stopScheduledTask(id);
  await prisma.scheduledTask.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
