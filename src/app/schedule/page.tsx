"use client";

import { useState, useEffect, useCallback } from "react";
import AuthGuard from "@/app/components/AuthGuard";
import { authFetch } from "@/lib/auth-client";

interface Task {
  id: string;
  name: string;
  schedule: string;
  cronExpr: string;
  reportType: string;
  enabled: boolean;
  plugin: string | null;
  createdAt: string;
}

const REPORT_TYPE_LABEL: Record<string, string> = {
  daily: "日报",
  weekly: "周报",
  monthly: "月报",
};

const SCHEDULE_EXAMPLES = [
  "Fri 17:00",
  "daily 09:00",
  "weekday 18:00",
  "Mon,Wed,Fri 10:00",
];

export default function SchedulePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 表单
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState("Fri 17:00");
  const [reportType, setReportType] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [plugin, setPlugin] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/schedule");
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const res = await authFetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          schedule: schedule.trim(),
          reportType,
          plugin: plugin.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "创建失败" });
      } else {
        setMessage({ type: "success", text: `任务"${data.task.name}"创建成功` });
        setName("");
        setPlugin("");
        loadTasks();
      }
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "网络错误" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (task: Task) => {
    try {
      const res = await authFetch(`/api/schedule/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !task.enabled }),
      });
      if (res.ok) {
        loadTasks();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (task: Task) => {
    if (!confirm(`确认删除任务"${task.name}"？`)) return;

    try {
      const res = await authFetch(`/api/schedule/${task.id}`, { method: "DELETE" });
      if (res.ok) {
        setMessage({ type: "success", text: `任务"${task.name}"已删除` });
        loadTasks();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <AuthGuard>
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">定时调度</h1>
        <p className="text-gray-600 dark:text-gray-400">
          设置定时任务，自动在指定时间生成报告。服务器重启后会自动恢复所有已启用的任务。
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-900"
              : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 创建任务 */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="text-xl font-semibold mb-4">创建定时任务</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">任务名称</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="如：周五周报"
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">调度时间</label>
              <input
                type="text"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                placeholder="Fri 17:00"
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">报告类型</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as "daily" | "weekly" | "monthly")}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="daily">日报</option>
                <option value="weekly">周报</option>
                <option value="monthly">月报</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                插件（留空 = 所有已落地插件）
              </label>
              <input
                type="text"
                value={plugin}
                onChange={(e) => setPlugin(e.target.value)}
                placeholder="如：git"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* 调度时间示例 */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>示例：</span>
            {SCHEDULE_EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setSchedule(ex)}
                className="px-2 py-1 rounded border border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:text-blue-600 transition-colors font-mono"
              >
                {ex}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {submitting ? "创建中..." : "创建任务"}
          </button>
        </form>
      </section>

      {/* 任务列表 */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="text-xl font-semibold mb-4">已有任务</h2>
        {loading ? (
          <div className="text-gray-500">加载中...</div>
        ) : tasks.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            暂无定时任务，在上方创建第一个任务
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-800"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-medium">{task.name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        task.enabled
                          ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                          : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                      }`}
                    >
                      {task.enabled ? "● 已启用" : "○ 已停用"}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
                    <span>
                      类型：{REPORT_TYPE_LABEL[task.reportType] || task.reportType}
                    </span>
                    <span className="font-mono">{task.schedule}</span>
                    <span className="font-mono text-xs text-gray-400">{task.cronExpr}</span>
                    {task.plugin && <span>插件：{task.plugin}</span>}
                    <span>创建于 {new Date(task.createdAt).toLocaleString("zh-CN")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleToggle(task)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      task.enabled
                        ? "bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300"
                        : "bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-950 dark:hover:bg-blue-900 dark:text-blue-300"
                    }`}
                  >
                    {task.enabled ? "停用" : "启用"}
                  </button>
                  <button
                    onClick={() => handleDelete(task)}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/30 dark:hover:bg-red-900/30 dark:text-red-400 transition-colors"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  </AuthGuard>);
}
