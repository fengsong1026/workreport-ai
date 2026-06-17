import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WorkReport AI — 全岗位智能工作汇报平台",
  description: "从工作数据源头自动采集，AI 自动生成汇报语言",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased min-h-screen bg-gray-50 dark:bg-gray-950">
        <nav className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2 font-semibold text-lg">
              <span className="text-blue-600">📊</span>
              <span>WorkReport AI</span>
            </a>
            <div className="flex items-center gap-6 text-sm">
              <a href="/" className="hover:text-blue-600 transition-colors">
                仪表盘
              </a>
              <a href="/reports" className="hover:text-blue-600 transition-colors">
                报告
              </a>
              <a
                href="/data-sources"
                className="hover:text-blue-600 transition-colors"
              >
                数据源
              </a>
              <a
                href="/settings"
                className="hover:text-blue-600 transition-colors"
              >
                设置
              </a>
            </div>
          </div>
        </nav>
        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
