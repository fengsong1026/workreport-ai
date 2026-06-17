"use client";

import { useState, useEffect, useCallback } from "react";

interface DataSource {
  name: string;
  displayName: string;
  dataSource: string;
  targetUsers: string;
  status: string;
  available: boolean;
}

export default function DataSourcesPage() {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const [gitPath, setGitPath] = useState("../git-weekly-automation");
  const [scanDir, setScanDir] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/data-sources");
      if (res.ok) {
        const data = await res.json();
        setDataSources(data.plugins || []);
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

  const handleCollect = async () => {
    if (!scanDir) {
      setMessage({ type: "error", text: "请输入扫描目录" });
      return;
    }
    setCollecting(true);
    setMessage({ type: "info", text: "正在采集 Git 提交记录..." });
    try {
      const res = await fetch("/api/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plugin: "git",
          scan: [scanDir],
          allAuthors: true,
          dryRun: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "采集失败" });
      } else {
        setMessage({ type: "success", text: data.message || "采集完成" });
      }
    } catch (e) {
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : "网络错误",
      });
    } finally {
      setCollecting(false);
    }
  };

  const handleDryRun = async () => {
    if (!scanDir) {
      setMessage({ type: "error", text: "请输入扫描目录" });
      return;
    }
    setCollecting(true);
    setMessage({ type: "info", text: "正在预览采集..." });
    try {
      const res = await fetch("/api/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plugin: "git",
          scan: [scanDir],
          allAuthors: true,
          dryRun: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "预览失败" });
      } else {
        setMessage({ type: "success", text: "预览完成（未写入数据）" });
      }
    } catch (e) {
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : "网络错误",
      });
    } finally {
      setCollecting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">数据源管理</h1>
        <p className="text-gray-600 dark:text-gray-400">
          管理各数据源插件，采集工作记录
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

      {/* 数据源列表 */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="text-xl font-semibold mb-4">所有数据源</h2>
        {loading ? (
          <div className="text-gray-500">加载中...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

      {/* Git 采集 */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="text-xl font-semibold mb-4">Git 数据采集</h2>
        <p className="text-sm text-gray-500 mb-4">
          从指定目录扫描 Git 仓库，采集提交记录。委托给 git-weekly-automation 采集器执行。
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              git-weekly-automation 路径
            </label>
            <input
              type="text"
              value={gitPath}
              onChange={(e) => setGitPath(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm"
              placeholder="../git-weekly-automation"
            />
            <p className="text-xs text-gray-400 mt-1">
              git-weekly-automation 项目路径（相对于本项目根目录）
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              扫描目录
            </label>
            <input
              type="text"
              value={scanDir}
              onChange={(e) => setScanDir(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm"
              placeholder="~/work 或 /path/to/projects"
            />
            <p className="text-xs text-gray-400 mt-1">
              要扫描 Git 仓库的目录路径
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleCollect}
              disabled={collecting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
            >
              {collecting ? "采集中..." : "开始采集"}
            </button>
            <button
              onClick={handleDryRun}
              disabled={collecting}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 text-sm"
            >
              预览（Dry Run）
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
