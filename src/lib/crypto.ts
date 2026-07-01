/**
 * 对称加密工具
 *
 * 用于加密存储 OAuth access token 等敏感数据。
 * 使用 AES-256-GCM，密钥由 JWT_SECRET 派生。
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.JWT_SECRET || "dev-secret-change-me";
  // 用 scrypt 派生 32 字节的 AES-256 密钥（缓存结果，避免重复阻塞事件循环）
  cachedKey = scryptSync(secret, "workreport-salt", 32);
  return cachedKey;
}

/** 加密明文，返回 base64 编码的 IV + authTag + ciphertext */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf-8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // 格式: iv + authTag + ciphertext，全部 base64 编码
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

/** 解密，返回明文。失败返回 null */
export function decryptToken(encoded: string): string | null {
  try {
    const key = getKey();
    const data = Buffer.from(encoded, "base64");

    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf-8");
  } catch {
    return null;
  }
}
