/**
 * 简单的内存速率限制器
 *
 * 基于 Map 实现，适合单进程部署。
 * 多进程部署需替换为 Redis 方案。
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// 定期清理过期条目，防止内存泄漏
const CLEANUP_INTERVAL = 60_000; // 每分钟
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

/**
 * 检查是否超过速率限制
 *
 * @param key   限流键（如邮箱、IP、用户ID）
 * @param maxAttempts 窗口内最大允许次数
 * @param windowMs    时间窗口（毫秒）
 * @returns true = 允许通过，false = 触发限流
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
): boolean {
  cleanup();

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxAttempts) {
    return false;
  }

  entry.count++;
  return true;
}

/** 重置某个 key 的限流计数（如登录成功后） */
export function resetRateLimit(key: string): void {
  store.delete(key);
}

/** 获取剩余尝试次数（用于提示用户），-1 表示不限或已重置 */
export function getRemainingAttempts(
  key: string,
  maxAttempts: number,
): number {
  const entry = store.get(key);
  if (!entry || Date.now() > entry.resetAt) return maxAttempts;
  return Math.max(0, maxAttempts - entry.count);
}
