/**
 * crypto.ts 单元测试
 */

import { describe, it, expect, beforeAll } from "vitest";

describe("encryptToken / decryptToken", () => {
  let encryptToken: Function;
  let decryptToken: Function;

  beforeAll(async () => {
    // 确保 JWT_SECRET 环境变量存在
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-for-unit-tests";
    const mod = await import("@/lib/crypto");
    encryptToken = mod.encryptToken;
    decryptToken = mod.decryptToken;
  });

  it("encrypts and decrypts round-trip", () => {
    const plaintext = "gho_test_github_token_12345";
    const encrypted = encryptToken(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted).toBeTypeOf("string");

    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertext for same plaintext (random IV)", () => {
    const plaintext = "same-token";
    const a = encryptToken(plaintext);
    const b = encryptToken(plaintext);
    expect(a).not.toBe(b);
    // Both should decrypt to the same value
    expect(decryptToken(a)).toBe(plaintext);
    expect(decryptToken(b)).toBe(plaintext);
  });

  it("returns null for tampered data", () => {
    const plaintext = "tamper-test";
    const encrypted = encryptToken(plaintext);
    // Flip a byte in the middle
    const bytes = Buffer.from(encrypted, "base64");
    bytes[10] = bytes[10] ^ 0xff;
    const tampered = bytes.toString("base64");
    expect(decryptToken(tampered)).toBeNull();
  });

  it("returns null for garbage input", () => {
    expect(decryptToken("not-valid-base64!!!")).toBeNull();
    expect(decryptToken("")).toBeNull();
    expect(decryptToken("YWJj")).toBeNull(); // too short
  });

  it("handles Chinese characters", () => {
    const plaintext = "中文测试令牌 🚀";
    const encrypted = encryptToken(plaintext);
    expect(decryptToken(encrypted)).toBe(plaintext);
  });

  it("handles empty string", () => {
    const encrypted = encryptToken("");
    expect(decryptToken(encrypted)).toBe("");
  });
});
