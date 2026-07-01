"use client";

import { useState, useEffect, useCallback } from "react";
import AuthGuard from "@/app/components/AuthGuard";
import { authFetch } from "@/lib/auth-client";

interface DataSource {
  name: string;
  displayName: string;
  dataSource: string;
  targetUsers: string;
  status: string;
  available: boolean;
}

interface ReportSummary {
  id: string;
  type: string;
  label: string;
  dateRange: string;
  recordCount: number;
  projectCount: number;
  createdAt: string;
}

export default function DashboardPage() {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [recentReports, setRecentReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dsRes, rptRes] = await Promise.all([
        authFetch("/api/data-sources"),
        authFetch("/api/reports?limit=5"),
      ]);
      if (dsRes.ok) {
        const dsData = await dsRes.json();
        setDataSources(dsData.plugins || []);
      }
      if (rptRes.ok) {
        const rptData = await rptRes.json();
        setRecentReports(rptData.reports || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGenerate = async (type: "daily" | "weekly" | "monthly") => {
    setGenerating(true);
    setMessage({ type: "info", text: `正在生成${type === "daily" ? "日报" : type === "weekly" ? "周报" : "月报"}...` });
    try {
      const res = await authFetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, allAuthors: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "生成失败" });
      } else {
        setMessage({
          type: "success",
          text: `报告已生成（${data.stats.recordCount} 条记录 / ${data.stats.projectCount} 个项目）`,
        });
        loadData();
      }
    } catch (e) {
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : "网络错误",
      });
    } finally {
      setGenerating(false);
    }
  };

  const typeLabel = (t: string) =>
    t === "daily" ? "日报" : t === "weekly" ? "周报" : "月报";

  return (
    <AuthGuard>
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">仪表盘</h1>
        <p className="text-gray-600 dark:text-gray-400">
          全岗位智能工作汇报平台 — 从工作数据源头自动采集，AI 自动生成汇报语言
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : message.type === "error"
                ? "bg-red-50 text-red-800 border border-red-200"
                : "bg-blue-50 text-blue-800 border border-blue-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 快速生成 */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="text-xl font-semibold mb-4">快速生成报告</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => handleGenerate("daily")}
            disabled={generating}
            className="p-4 rounded-lg border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 dark:border-blue-900 dark:hover:bg-blue-950 transition-all text-left disabled:opacity-50"
          >
            <div className="text-2xl mb-2">📝</div>
            <div className="font-semibold">今日日报</div>
            <div className="text-sm text-gray-500 mt-1">生成今天的日报</div>
          </button>
          <button
            onClick={() => handleGenerate("weekly")}
            disabled={generating}
            className="p-4 rounded-lg border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 dark:border-blue-900 dark:hover:bg-blue-950 transition-all text-left disabled:opacity-50"
          >
            <div className="text-2xl mb-2">📅</div>
            <div className="font-semibold">本周周报</div>
            <div className="text-sm text-gray-500 mt-1">生成本周的周报</div>
          </button>
          <button
            onClick={() => handleGenerate("monthly")}
            disabled={generating}
            className="p-4 rounded-lg border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 dark:border-blue-900 dark:hover:bg-blue-950 transition-all text-left disabled:opacity-50"
          >
            <div className="text-2xl mb-2">🗓️</div>
            <div className="font-semibold">本月月报</div>
            <div className="text-sm text-gray-500 mt-1">生成本月的月报</div>
          </button>
        </div>
      </section>

      {/* 数据源状态 */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">数据源</h2>
          <a
            href="/data-sources"
            className="text-sm text-blue-600 hover:underline"
          >
            管理数据源 →
          </a>
        </div>
        {loading ? (
          <div className="text-gray-500">加载中...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {dataSources.map((ds) => (
              <div
                key={ds.name}
                className="p-4 rounded-lg border border-gray-200 dark:border-gray-800"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{ds.displayName}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      ds.available
                        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    }`}
                  >
                    {ds.available ? "✅ 已完成" : "⏳ 规划中"}
                  </span>
                </div>
                <div className="text-sm text-gray-500 mb-1">{ds.dataSource}</div>
                <div className="text-xs text-gray-400">{ds.targetUsers}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 最近报告 */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">最近生成的报告</h2>
          <a href="/reports" className="text-sm text-blue-600 hover:underline">
            查看全部 →
          </a>
        </div>
        {recentReports.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            暂无报告，点击上方按钮生成第一份报告
          </div>
        ) : (
          <div className="space-y-2">
            {recentReports.map((r) => (
              <a
                key={r.id}
                href={`/reports?id=${r.id}`}
                className="block p-3 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">
                      {typeLabel(r.type)} — {r.label}
                    </span>
                    <span className="text-sm text-gray-500 ml-2">
                      {r.dateRange}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {r.recordCount} 条记录 / {r.projectCount} 个项目
                  </div>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(r.createdAt).toLocaleString("zh-CN")}
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  </AuthGuard>);
}
