"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  authFetch,
  removeToken,
  notifyLogout,
  LOGIN_EVENT,
  LOGOUT_EVENT,
  UNAUTHORIZED_EVENT,
} from "@/lib/auth-client";

interface UserInfo {
  name: string;
  email: string;
}

/**
 * 导航栏用户区域
 *
 * 位于 root layout — 客户端路由切换时本组件不会重新挂载，
 * 因此 useEffect([]) 只在首次加载时跑一次。
 * 登录/注册成功后由 login/register 页派发 auth:login 事件，
 * 本组件监听该事件重新拉取 /api/auth/me，刷新右上角用户状态。
 * 登出/401 时派发 auth:logout，本组件同步清除 UI。
 */
export default function UserNav() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      const res = await authFetch("/api/auth/me");
      if (!res.ok) {
        setUser(null);
        return;
      }
      const data = await res.json();
      if (data?.user) setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // 监听登录事件：login/register 成功后重新拉取用户信息
  useEffect(() => {
    const handler = () => {
      setLoading(true);
      loadUser();
    };
    window.addEventListener(LOGIN_EVENT, handler);
    return () => window.removeEventListener(LOGIN_EVENT, handler);
  }, [loadUser]);

  // 监听登出/401 事件：同步清除 UI
  useEffect(() => {
    const handler = () => setUser(null);
    window.addEventListener(LOGOUT_EVENT, handler);
    window.addEventListener(UNAUTHORIZED_EVENT, handler);
    return () => {
      window.removeEventListener(LOGOUT_EVENT, handler);
      window.removeEventListener(UNAUTHORIZED_EVENT, handler);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await authFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // 网络错误时仍然清除本地状态
    }
    removeToken();
    setUser(null);
    // 通知其他组件（如 AuthGuard 所在页面）清除登录态
    notifyLogout();
    router.push("/login");
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
