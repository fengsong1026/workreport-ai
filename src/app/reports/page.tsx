"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import ReactMarkdown from "react-markdown";
import { useSearchParams } from "next/navigation";

interface ReportSummary {
  id: string;
  type: string;
  label: string;
  dateRange: string;
  recordCount: number;
  projectCount: number;
  createdAt: string;
}

interface ReportDetail extends ReportSummary {
  content: string;
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="text-gray-500">加载中...</div>}>
      <ReportsContent />
    </Suspense>
  );
}

function ReportsContent() {
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("id");

  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [selected, setSelected] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reports?limit=100");
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/reports?id=${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelected(data.report);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
    else setSelected(null);
  }, [selectedId, loadDetail]);

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除这份报告？")) return;
    try {
      const res = await fetch(`/api/reports?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        loadReports();
        if (selected?.id === id) setSelected(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const typeLabel = (t: string) =>
    t === "daily" ? "日报" : t === "weekly" ? "周报" : "月报";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">报告管理</h1>
        <p className="text-gray-600 dark:text-gray-400">
          查看历史生成的报告，支持 Markdown 渲染
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 报告列表 */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <h2 className="font-semibold mb-3">报告列表</h2>
            {loading ? (
              <div className="text-gray-500 text-sm">加载中...</div>
            ) : reports.length === 0 ? (
              <div className="text-gray-500 text-sm text-center py-8">
                暂无报告
              </div>
            ) : (
              <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                {reports.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => loadDetail(r.id)}
                    className={`block w-full text-left p-3 rounded-lg border transition-colors ${
                      selected?.id === r.id
                        ? "border-blue-400 bg-blue-50 dark:bg-blue-950"
                        : "border-gray-200 dark:border-gray-800 hover:border-blue-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">
                        {typeLabel(r.type)} {r.label}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">{r.dateRange}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(r.createdAt).toLocaleString("zh-CN")}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 报告详情 */}
        <div className="lg:col-span-2">
          {selected ? (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200 dark:border-gray-800">
                <div>
                  <h2 className="text-xl font-semibold">
                    {typeLabel(selected.type)} — {selected.label}
                  </h2>
                  <div className="text-sm text-gray-500 mt-1">
                    {selected.dateRange} · {selected.recordCount} 条记录 ·{" "}
                    {selected.projectCount} 个项目
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(selected.id)}
                  className="text-sm text-red-600 hover:underline"
                >
                  删除
                </button>
              </div>
              <div className="markdown-body max-h-[70vh] overflow-y-auto">
                <ReactMarkdown>{selected.content}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-12 text-center text-gray-500">
              <div className="text-4xl mb-3">📄</div>
              <div>选择左侧的报告查看详情</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
