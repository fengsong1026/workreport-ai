"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isAuthenticated, UNAUTHORIZED_EVENT } from "@/lib/auth-client";

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * 客户端认证守卫
 *
 * - 检查 token 是否存在且未过期，否则重定向到 /login
 * - 监听 auth:unauthorized 事件（authFetch 收到 401 时派发），自动跳转登录
 */
export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  const redirectToLogin = useCallback(() => {
    // 避免 /login → /login 循环
    if (pathname === "/login" || pathname === "/register") return;
    router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
  }, [router, pathname]);

  useEffect(() => {
    if (!isAuthenticated()) {
      redirectToLogin();
      return;
    }
    setReady(true);
  }, [redirectToLogin]);

  // 监听 authFetch 的 401 事件，统一处理登录过期
  useEffect(() => {
    const handler = () => redirectToLogin();
    window.addEventListener(UNAUTHORIZED_EVENT, handler);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler);
  }, [redirectToLogin]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return <>{children}</>;
}
