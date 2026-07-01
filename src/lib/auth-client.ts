/**
 * 客户端 auth 工具
 *
 * Token 存储在 localStorage，通过 Authorization: Bearer 头发送。
 * authFetch 在收到 401 时自动清除 token 并派发 auth:unauthorized 事件，
 * AuthGuard 监听到该事件后通过 router 重定向到登录页。
 */

const TOKEN_KEY = "wr_token";
const UNAUTHORIZED_EVENT = "auth:unauthorized";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

/** 解析 JWT 的 exp 字段，过期返回 true */
export function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return true;
    // JWT 使用 base64url 编码，atob 只认标准 base64 — 先转换
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64));
    if (!payload.exp || typeof payload.exp !== "number") return false;
    return payload.exp * 1000 < Date.now();
  } catch {
    return true; // 解析失败视为过期
  }
}

/** token 存在且未过期 */
export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;
  return !isTokenExpired(token);
}

/** 带 Authorization 头的 fetch，401 时自动清除 token */
export function authFetch(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  const token = getToken();
  return fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }).then((res) => {
    if (res.status === 401) {
      removeToken();
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }
    return res;
  });
}

export { UNAUTHORIZED_EVENT };

/** 校验 redirect 参数是否为同源路径，防止 open redirect */
export function isSafeRedirect(path: string): boolean {
  try {
    const url = new URL(path, window.location.origin);
    return url.origin === window.location.origin;
  } catch {
    return false;
  }
}
