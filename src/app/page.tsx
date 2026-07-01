"use client";

import { useEffect, useState } from "react";
import { isAuthenticated, authFetch } from "@/lib/auth-client";

/**
 * 公开落地页（无需登录）
 *
 * 核心传达：不是又一个"填表式周报工具"，
 * 而是从工作数据源头自动采集、AI 自动生成——汇报是副产品，工作本身才是输入。
 */

export default function LandingPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      setChecked(true);
      return;
    }

    authFetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setLoggedIn(!!d?.user))
      .catch(() => {})
      .finally(() => setChecked(true));
  }, []);

  return (
    <div className="space-y-24 pb-16">
      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden pt-12">
        {/* 背景渐变 */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] -z-10 bg-blue-200/20 dark:bg-blue-500/10 rounded-full blur-3xl" />

        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 text-sm text-blue-600 dark:text-blue-400 mb-8">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            全岗位智能工作汇报平台
          </div>

          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
            汇报是<span className="text-blue-600">副产品</span>
            <br />
            工作本身才是<span className="text-blue-600">输入</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            不是又一个&quot;填表式周报工具&quot;。<br className="hidden sm:block" />
            从工作数据源头自动采集，AI 自动生成——
            你只管干活，汇报交给 AI。
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {checked && loggedIn ? (
              <a
                href="/dashboard"
                className="px-8 py-3.5 bg-blue-600 text-white rounded-xl font-medium text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/30 hover:-translate-y-0.5"
              >
                进入仪表盘 →
              </a>
            ) : (
              <a
                href="/register"
                className="px-8 py-3.5 bg-blue-600 text-white rounded-xl font-medium text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/30 hover:-translate-y-0.5"
              >
                免费开始使用
              </a>
            )}
            <a
              href="#how-it-works"
              className="px-8 py-3.5 border border-gray-300 dark:border-gray-700 rounded-xl font-medium text-lg hover:border-blue-400 hover:text-blue-600 transition-colors"
            >
              了解工作原理
            </a>
          </div>

          {/* 数据流示意 */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-3 text-sm text-gray-500">
            <span className="px-3 py-1.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">Git 提交</span>
            <span className="text-blue-400">→</span>
            <span className="px-3 py-1.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">任务系统</span>
            <span className="text-blue-400">→</span>
            <span className="px-3 py-1.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">日历记录</span>
            <span className="text-blue-400">→</span>
            <span className="px-3 py-1.5 rounded-lg bg-blue-600 text-white shadow-sm">AI 汇报</span>
          </div>
        </div>
      </section>

      {/* ===== 核心差异 ===== */}
      <section className="max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-6">
          {/* 传统方式 */}
          <div className="p-8 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
            <div className="text-3xl mb-4">😩</div>
            <h3 className="text-xl font-semibold mb-3 text-gray-500 dark:text-gray-400">
              传统填表式周报
            </h3>
            <ul className="space-y-2.5 text-sm text-gray-500 dark:text-gray-500">
              <li className="flex gap-2">
                <span className="text-red-400">✗</span>
                手动回忆一周干了什么
              </li>
              <li className="flex gap-2">
                <span className="text-red-400">✗</span>
                翻多个工具找历史记录
              </li>
              <li className="flex gap-2">
                <span className="text-red-400">✗</span>
                用自然语言重新描述
              </li>
              <li className="flex gap-2">
                <span className="text-red-400">✗</span>
                套公司模板格式
              </li>
              <li className="flex gap-2">
                <span className="text-red-400">✗</span>
                耗时 30–60 分钟，质量靠表达能力
              </li>
            </ul>
          </div>

          {/* WorkReport AI */}
          <div className="p-8 rounded-2xl border-2 border-blue-300 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/20 relative">
            <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-blue-600 text-white text-xs font-medium">
              WorkReport AI
            </div>
            <div className="text-3xl mb-4">🚀</div>
            <h3 className="text-xl font-semibold mb-3 text-blue-600 dark:text-blue-400">
              数据驱动自动生成
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li className="flex gap-2">
                <span className="text-green-500">✓</span>
                自动从数据源头采集工作痕迹
              </li>
              <li className="flex gap-2">
                <span className="text-green-500">✓</span>
                AI 聚合 + 结构化生成
              </li>
              <li className="flex gap-2">
                <span className="text-green-500">✓</span>
                一键生成日报 / 周报 / 月报
              </li>
              <li className="flex gap-2">
                <span className="text-green-500">✓</span>
                模板可定制，适配公司格式
              </li>
              <li className="flex gap-2">
                <span className="text-green-500">✓</span>
                0 人工干预，周五自动交卷
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ===== 工作原理 ===== */}
      <section id="how-it-works" className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">三步开始自动汇报</h2>
          <p className="text-gray-500 dark:text-gray-400">
            连接一次，从此告别手写周报
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="relative p-8 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
            <div className="absolute -top-4 left-8 w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
              1
            </div>
            <div className="text-3xl mb-4 mt-2">🔌</div>
            <h3 className="text-lg font-semibold mb-2">连接数据源</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              通过 OAuth 授权连接你的工作工具——GitHub、Jira、飞书、Google Calendar 等。
              一次连接，持续自动采集。
            </p>
          </div>

          <div className="relative p-8 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
            <div className="absolute -top-4 left-8 w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
              2
            </div>
            <div className="text-3xl mb-4 mt-2">🤖</div>
            <h3 className="text-lg font-semibold mb-2">AI 自动生成</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              AI 引擎聚合你的工作数据，按项目分组、提炼重点，
              生成结构化的中文汇报语言，支持自定义模板。
            </p>
          </div>

          <div className="relative p-8 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
            <div className="absolute -top-4 left-8 w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
              3
            </div>
            <div className="text-3xl mb-4 mt-2">📄</div>
            <h3 className="text-lg font-semibold mb-2">一键出报告</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              日报、周报、月报随时生成。
              支持定时调度，周五 17:00 自动交卷，无需手动操作。
            </p>
          </div>
        </div>
      </section>

      {/* ===== 数据源插件 ===== */}
      <section className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">覆盖全岗位工作数据</h2>
          <p className="text-gray-500 dark:text-gray-400">
            插件化架构，每类岗位对应一个数据采集子应用
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-6 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">💻</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                ✅ 已完成
              </span>
            </div>
            <h3 className="font-semibold mb-1">Git Weekly</h3>
            <p className="text-xs text-gray-500 mb-2">GitHub / GitLab 提交记录</p>
            <p className="text-xs text-gray-400">程序员 / 技术研究员</p>
          </div>

          <div className="p-6 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">📋</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                规划中
              </span>
            </div>
            <h3 className="font-semibold mb-1">Task Reporter</h3>
            <p className="text-xs text-gray-500 mb-2">Jira / Linear / 飞书任务</p>
            <p className="text-xs text-gray-400">产品 / 项目管理</p>
          </div>

          <div className="p-6 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">📅</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                规划中
              </span>
            </div>
            <h3 className="font-semibold mb-1">Calendar Reporter</h3>
            <p className="text-xs text-gray-500 mb-2">Google Calendar / 企业微信</p>
            <p className="text-xs text-gray-400">所有岗位</p>
          </div>

          <div className="p-6 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">📝</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                规划中
              </span>
            </div>
            <h3 className="font-semibold mb-1">Doc Reporter</h3>
            <p className="text-xs text-gray-500 mb-2">Notion / 语雀 / Confluence</p>
            <p className="text-xs text-gray-400">内容 / 运营</p>
          </div>
        </div>
      </section>

      {/* ===== 特性 ===== */}
      <section className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">为什么选择 WorkReport AI</h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: "🔌",
              title: "零侵入采集",
              desc: "通过 OAuth 连接工作工具，对现有工作流完全透明，不改变你的工作习惯。",
            },
            {
              icon: "🧠",
              title: "AI 智能生成",
              desc: "对接 OpenAI / DeepSeek 等兼容 API，自动聚合工作数据，生成结构化中文汇报。",
            },
            {
              icon: "⏰",
              title: "定时调度",
              desc: "支持 cron 定时任务，周五 17:00 自动生成周报，真正做到零人工干预。",
            },
            {
              icon: "📐",
              title: "模板可定制",
              desc: "{{占位符}} 语法，按团队 / 公司汇报格式自由配置，适配你的模板。",
            },
            {
              icon: "🔐",
              title: "数据隔离",
              desc: "用户系统 + JWT 鉴权，每个人的数据源和报告完全隔离，安全可靠。",
            },
            {
              icon: "🌐",
              title: "全岗位覆盖",
              desc: "插件化架构，程序员、产品、运营、销售——每个岗位都有对应的数据采集插件。",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="p-6 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-800 transition-colors"
            >
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="max-w-4xl mx-auto">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 to-purple-600 p-12 text-center">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              把周报交给 AI，把时间还给工作
            </h2>
            <p className="text-blue-100 text-lg mb-8 max-w-xl mx-auto">
              注册即可开始使用，连接 GitHub 数据源，30 秒生成你的第一份 AI 周报。
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {checked && loggedIn ? (
                <a
                  href="/dashboard"
                  className="px-8 py-3.5 bg-white text-blue-600 rounded-xl font-medium text-lg hover:bg-blue-50 transition-colors"
                >
                  进入仪表盘 →
                </a>
              ) : (
                <>
                  <a
                    href="/register"
                    className="px-8 py-3.5 bg-white text-blue-600 rounded-xl font-medium text-lg hover:bg-blue-50 transition-colors"
                  >
                    免费注册
                  </a>
                  <a
                    href="/login"
                    className="px-8 py-3.5 border border-white/30 text-white rounded-xl font-medium text-lg hover:bg-white/10 transition-colors"
                  >
                    登录
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
