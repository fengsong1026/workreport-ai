"use client";

import { useEffect, useState } from "react";

interface UserInfo {
  name: string;
  email: string;
}

/**
 * 导航栏用户区域
 *
 * 调用 /api/auth/me 获取当前登录状态：
 * - 未登录：显示「登录」链接
 * - 已登录：显示用户名 + 「个人中心」+ 「退出」
 */
export default function UserNav() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    window.location.href = "/login";
  };

  if (loading) {
    return <div className="w-20" />;
  }

  if (!user) {
    return (
      <a
        href="/login"
        className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
      >
        登录
      </a>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <a
        href="/profile"
        className="flex items-center gap-2 hover:text-blue-600 transition-colors"
      >
        <span className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-300">
          {user.name[0]?.toUpperCase()}
        </span>
        <span className="hidden sm:inline">{user.name}</span>
      </a>
      <button
        onClick={handleLogout}
        className="text-sm text-gray-500 hover:text-red-600 transition-colors"
      >
        退出
      </button>
    </div>
  );
}
