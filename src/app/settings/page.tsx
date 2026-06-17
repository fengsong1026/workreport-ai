"use client";

import { useState, useEffect, useCallback } from "react";

interface Config {
  apiKey: string;
  apiBase: string;
  model: string;
  maxTokens: number;
  apiKeyMasked?: string;
}

export default function SettingsPage() {
  const [config, setConfig] = useState<Config>({
    apiKey: "",
    apiBase: "https://api.deepseek.com",
    model: "deepseek-v4-flash",
    maxTokens: 4096,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/config");
      if (res.ok) {
        const data = await res.json();
        setConfig({
          apiKey: "",
          apiBase: data.apiBase,
          model: data.model,
          maxTokens: data.maxTokens,
          apiKeyMasked: data.apiKeyMasked,
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const body: Record<string, string | number> = {
        apiBase: config.apiBase,
        model: config.model,
        maxTokens: config.maxTokens,
      };
      if (config.apiKey) body.apiKey = config.apiKey;

      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "保存失败" });
      } else {
        setMessage({ type: "success", text: "配置已保存" });
        setConfig((c) => ({ ...c, apiKey: "", apiKeyMasked: data.config?.apiKey?.slice(0, 6) + "..." }));
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

  if (loading) {
    return <div className="text-gray-500">加载中...</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold mb-2">设置</h1>
        <p className="text-gray-600 dark:text-gray-400">
          配置 AI API、数据源路径等
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* API 配置 */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="text-xl font-semibold mb-4">AI API 配置</h2>
        <p className="text-sm text-gray-500 mb-4">
          支持 OpenAI / DeepSeek / vLLM / Ollama / LiteLLM 等任意 OpenAI 兼容 API
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">API Key</label>
            {config.apiKeyMasked && (
              <p className="text-xs text-gray-400 mb-1">
                当前: {config.apiKeyMasked}（留空则不修改）
              </p>
            )}
            <input
              type="password"
              value={config.apiKey}
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm"
              placeholder="sk-your-api-key"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">API Base URL</label>
            <input
              type="text"
              value={config.apiBase}
              onChange={(e) => setConfig({ ...config, apiBase: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm"
              placeholder="https://api.deepseek.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">模型</label>
            <input
              type="text"
              value={config.model}
              onChange={(e) => setConfig({ ...config, model: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm"
              placeholder="deepseek-v4-flash"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              最大 Token 数
            </label>
            <input
              type="number"
              value={config.maxTokens}
              onChange={(e) =>
                setConfig({ ...config, maxTokens: Number(e.target.value) })
              }
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm"
              placeholder="4096"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
          >
            {saving ? "保存中..." : "保存配置"}
          </button>
        </div>
      </section>

      {/* 关于 */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="text-xl font-semibold mb-4">关于</h2>
        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
          <div>
            <strong>WorkReport AI</strong> — 全岗位智能工作汇报平台
          </div>
          <div>
            采用数据源插件化架构，每类岗位对应一个数据采集子应用，共享同一 AI 生成引擎。
          </div>
          <div className="pt-2 border-t border-gray-200 dark:border-gray-800 mt-3">
            <div>技术栈：Next.js + TypeScript + SQLite + Prisma</div>
            <div>AI 引擎：OpenAI 兼容 API</div>
          </div>
        </div>
      </section>
    </div>
  );
}
