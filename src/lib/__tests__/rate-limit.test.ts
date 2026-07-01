/**
 * rate-limit.ts 单元测试
 */

import { describe, it, expect, beforeEach } from "vitest";

async function loadModule() {
  return await import("@/lib/rate-limit");
}

describe("checkRateLimit", () => {
  let checkRateLimit: Function;
  let resetRateLimit: Function;

  beforeEach(async () => {
    const mod = await loadModule();
    checkRateLimit = mod.checkRateLimit;
    resetRateLimit = mod.resetRateLimit;
  });

  it("allows requests within limit", () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit("test-key", 5, 60_000)).toBe(true);
    }
  });

  it("blocks requests exceeding limit", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("test-key-2", 5, 60_000);
    }
    expect(checkRateLimit("test-key-2", 5, 60_000)).toBe(false);
  });

  it("resets after window expires", async () => {
    const key = "expiring-key";
    // Use a very short window
    for (let i = 0; i < 3; i++) {
      checkRateLimit(key, 3, 1); // 1ms window
    }
    expect(checkRateLimit(key, 3, 1)).toBe(false);
    // Wait for window to expire
    await new Promise((r) => setTimeout(r, 5));
    expect(checkRateLimit(key, 3, 1)).toBe(true);
  });

  it("resetRateLimit clears the counter", () => {
    const key = "reset-key";
    for (let i = 0; i < 3; i++) {
      checkRateLimit(key, 3, 60_000);
    }
    expect(checkRateLimit(key, 3, 60_000)).toBe(false);
    resetRateLimit(key);
    expect(checkRateLimit(key, 3, 60_000)).toBe(true);
  });

  it("isolates different keys", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("key-a", 5, 60_000);
    }
    expect(checkRateLimit("key-a", 5, 60_000)).toBe(false);
    expect(checkRateLimit("key-b", 5, 60_000)).toBe(true);
  });
});

describe("getRemainingAttempts", () => {
  it("returns max when no attempts yet", async () => {
    const { getRemainingAttempts } = await loadModule();
    expect(getRemainingAttempts("fresh-key", 5)).toBe(5);
  });

  it("returns remaining count after some attempts", async () => {
    const { checkRateLimit, getRemainingAttempts } = await loadModule();
    const key = "count-key";
    checkRateLimit(key, 5, 60_000);
    checkRateLimit(key, 5, 60_000);
    expect(getRemainingAttempts(key, 5)).toBe(3);
  });

  it("returns 0 when exhausted", async () => {
    const { checkRateLimit, getRemainingAttempts } = await loadModule();
    const key = "exhausted-key";
    for (let i = 0; i < 5; i++) {
      checkRateLimit(key, 5, 60_000);
    }
    expect(getRemainingAttempts(key, 5)).toBe(0);
  });
});
