"use client";

import { useState, useEffect, useCallback } from "react";

interface Repo {
  id: number;
  fullName: string;
  selected: boolean;
}

interface DataSource {
  name: string;
  displayName: string;
  dataSource: string;
  targetUsers: string;
  status: string;
  available: boolean;
  connected: boolean;
  user?: { login?: string; name?: string | null };
  repoCount?: number;
  selectedRepoCount?: number;
  repos?: Repo[];
}

interface Provider {
  name: string;
  displayName: string;
  plugin: string;
  connected: boolean;
  special: boolean;
  docsUrl: string | null;
}

export default function DataSourcesPage() {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedRepos, setSelectedRepos] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/data-sources");
      if (res.ok) {
        const data = await res.json();
        setDataSources(data.plugins || []);
        setProviders(data.providers || []);
        // 初始化已选仓库
        const git = (data.plugins || []).find(
          (p: DataSource) => p.name === "git",
        );
        if (git?.repos) {
          setSelectedRepos(
            new Set(git.repos.filter((r: Repo) => r.selected).map((r: Repo) => r.id)),
          );
        }
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

  // 从 URL 参数读取 OAuth 回调消息
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error = params.get("error");
    if (connected) {
      const label = connected === "github" ? "GitHub" : connected;
      setMessage({ type: "success", text: `${label} 连接成功！` });
    } else if (error) {
      const msg = params.get("msg") || error;
      setMessage({ type: "error", text: `连接失败: ${msg}` });
    }
  }, []);

  const gitPlugin = dataSources.find((p) => p.name === "git");

  const handleSyncRepos = async () => {
    setSyncing(true);
    setMessage({ type: "info", text: "正在从 GitHub 同步仓库列表..." });
    try {
      const res = await fetch("/api/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plugin: "git" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "同步失败" });
      } else {
        setMessage({ type: "success", text: data.message || "同步完成" });
        loadData();
      }
    } catch (e) {
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : "网络错误",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveSelection = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/data-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "git",
          action: "select-repos",
          repos: Array.from(selectedRepos),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "保存失败" });
      } else {
        setMessage({ type: "success", text: data.message || "保存成功" });
        loadData();
      }
    } catch (e) {
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : "网络错误",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("确定断开 GitHub 连接？")) return;
    try {
      await fetch("/api/data-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "git", action: "disconnect" }),
      });
      loadData();
      setMessage({ type: "info", text: "已断开 GitHub 连接" });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDisconnectProvider = async (provider: Provider) => {
    if (!confirm(`确定断开 ${provider.displayName} 连接？`)) return;
    try {
      await fetch("/api/data-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: provider.name, action: "disconnect" }),
      });
      loadData();
      setMessage({ type: "info", text: `已断开 ${provider.displayName} 连接` });
    } catch (e) {
      console.error(e);
    }
  };

  const toggleRepo = (id: number) => {
    setSelectedRepos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (repos: Repo[]) => {
    setSelectedRepos((prev) => {
      if (repos.every((r) => prev.has(r.id))) {
        // 全选了 → 取消全选
        const next = new Set(prev);
        repos.forEach((r) => next.delete(r.id));
        return next;
      }
      // 否则全选
      const next = new Set(prev);
      repos.forEach((r) => next.add(r.id));
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">数据源管理</h1>
        <p className="text-gray-600 dark:text-gray-400">
          连接数据源，选择要纳入报告的仓库
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
                  <div className="flex items-center gap-2">
                    {ds.connected && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        已连接
                      </span>
                    )}
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
                </div>
                <div className="text-sm text-gray-500 mb-1">{ds.dataSource}</div>
                <div className="text-xs text-gray-400">{ds.targetUsers}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Git 连接管理（GitHub + GitLab） */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="text-xl font-semibold mb-4">Git</h2>

        {/* GitHub */}
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">GitHub</h3>
        {!gitPlugin?.connected ? (
          /* 未连接：显示连接按钮 */
          <div className="text-center py-8">
            <div className="text-4xl mb-3">🔗</div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              连接 GitHub 账号，自动获取提交记录生成报告
            </p>
            <a
              href="/api/oauth/github"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
            >
              <svg
                height="20"
                width="20"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              连接 GitHub
            </a>
            <p className="text-xs text-gray-400 mt-3">
              授权后将获取你的仓库列表，可选择要纳入报告的仓库
            </p>
          </div>
        ) : (
          /* 已连接：显示用户信息 + 仓库列表 */
          <div className="space-y-4">
            {/* 用户信息 */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-lg font-bold">
                  {(gitPlugin.user?.login || "?")[0].toUpperCase()}
                </div>
                <div>
                  <div className="font-medium">
                    {gitPlugin.user?.name || gitPlugin.user?.login}
                  </div>
                  <div className="text-sm text-gray-500">
                    @{gitPlugin.user?.login}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSyncRepos}
                  disabled={syncing}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  {syncing ? "同步中..." : "同步仓库"}
                </button>
                <button
                  onClick={handleDisconnect}
                  className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                >
                  断开
                </button>
              </div>
            </div>

            {/* 仓库列表 */}
            {gitPlugin.repos && gitPlugin.repos.length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">
                    仓库列表（{selectedRepos.size}/{gitPlugin.repos.length} 已选）
                  </h3>
                  <button
                    onClick={() => toggleAll(gitPlugin.repos!)}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {gitPlugin.repos.every((r) => selectedRepos.has(r.id))
                      ? "取消全选"
                      : "全选"}
                  </button>
                </div>
                <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-800 rounded-lg">
                  {gitPlugin.repos.map((repo) => (
                    <label
                      key={repo.id}
                      className="flex items-center gap-3 p-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-100 dark:border-gray-800 last:border-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedRepos.has(repo.id)}
                        onChange={() => toggleRepo(repo.id)}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm font-mono">{repo.fullName}</span>
                    </label>
                  ))}
                </div>
                <button
                  onClick={handleSaveSelection}
                  disabled={saving}
                  className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
                >
                  {saving ? "保存中..." : "保存选择"}
                </button>
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <p className="mb-3">
                  {gitPlugin.repoCount === 0
                    ? "尚未同步仓库列表"
                    : "仓库列表为空"}
                </p>
                <button
                  onClick={handleSyncRepos}
                  disabled={syncing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
                >
                  {syncing ? "同步中..." : "同步仓库列表"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* GitLab */}
        {providers
          .filter((p) => p.name === "gitlab")
          .map((p) => (
            <div key={p.name} className="mt-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                GitLab
              </h3>
              <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{p.displayName}</span>
                    {p.connected ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        已连接
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        未连接
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!p.connected ? (
                    <a
                      href={`/api/oauth/${p.name}`}
                      className="text-sm px-4 py-2 rounded-lg transition-colors bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600"
                    >
                      连接 {p.displayName}
                    </a>
                  ) : (
                    <button
                      onClick={() => handleDisconnectProvider(p)}
                      className="text-sm px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                    >
                      断开
                    </button>
                  )}
                  {p.docsUrl && (
                    <a
                      href={p.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      注册 OAuth App →
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
      </section>

      {/* 按插件分组的数据源连接管理，每个 provider 独占一行 */}
      {[
        { key: "task", label: "Task Reporter", desc: "Jira / Linear / 飞书任务" },
        { key: "calendar", label: "Calendar Reporter", desc: "Google Calendar / 企业微信日历" },
        { key: "doc", label: "Doc Reporter", desc: "Notion / 语雀 / Confluence" },
      ].map(({ key, label, desc }) => {
        const group = providers.filter((p) => p.plugin === key);
        if (group.length === 0) return null;
        return (
          <section
            key={key}
            className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6"
          >
            <div className="mb-4">
              <h2 className="text-xl font-semibold">{label}</h2>
              <p className="text-sm text-gray-500">{desc}</p>
            </div>
            <div className="space-y-3">
              {group.map((p) => (
                <div
                  key={p.name}
                  className="p-4 rounded-lg border border-gray-200 dark:border-gray-800 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{p.displayName}</span>
                      {p.connected ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                          已连接
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                          未连接
                        </span>
                      )}
                      {p.special && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                          需额外配置
                        </span>
                      )}
                    </div>
                    {p.special && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        非标准 OAuth 流程，暂未实现自动连接
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!p.connected ? (
                      <a
                        href={`/api/oauth/${p.name}`}
                        className={`text-sm px-4 py-2 rounded-lg transition-colors ${
                          p.special
                            ? "bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-800"
                            : "bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600"
                        }`}
                        onClick={(e) => p.special && e.preventDefault()}
                      >
                        连接 {p.displayName}
                      </a>
                    ) : (
                      <button
                        onClick={() => handleDisconnectProvider(p)}
                        className="text-sm px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                      >
                        断开
                      </button>
                    )}
                    {p.docsUrl && (
                      <a
                        href={p.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        注册 OAuth App →
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
