/**
 * 通用 OAuth 2.0 工具函数
 *
 * 支持标准 authorization code flow。
 * github 有自己的专用实现（github.ts），此模块服务于其他 provider。
 *
 * getRequestOrigin 从此模块导出，github.ts 也复用。
 */

import { NextRequest } from "next/server";
import { getProviderConfig, type OAuthProviderConfig } from "./oauth-providers";

/**
 * 从请求中推导出完整的 origin（协议 + 主机）
 *
 * 支持反向代理（nginx）场景下的 x-forwarded-* headers，
 * 保证获取到的是用户实际访问的地址，而非容器内部地址。
 */
export function getRequestOrigin(req: NextRequest): string {
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = req.headers.get("host");

  const finalHost = forwardedHost || host;
  if (finalHost) {
    const proto = forwardedProto || (finalHost.startsWith("localhost") ? "http" : "https");
    return `${proto}://${finalHost}`;
  }

  // 兜底：从请求 URL 解析
  return new URL(req.url).origin;
}

export interface ProviderOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  providerConfig: OAuthProviderConfig;
}

/**
 * 从环境变量读取 provider 的 OAuth 配置
 *
 * 环境变量命名规则：{ENV_VAR_PREFIX}_CLIENT_ID / {ENV_VAR_PREFIX}_CLIENT_SECRET
 * 如 JIRA_CLIENT_ID / JIRA_CLIENT_SECRET
 *
 * redirect_uri 运行时动态拼接（origin + /api/oauth/callback/<provider>），
 * 无需在 .env 中配置。
 */
export function getProviderOAuthConfig(
  provider: string,
  origin: string,
): ProviderOAuthConfig {
  const providerConfig = getProviderConfig(provider);
  if (!providerConfig) {
    throw new Error(`未知 OAuth provider: ${provider}`);
  }

  const prefix = providerConfig.envVarPrefix;
  const clientId = process.env[`${prefix}_CLIENT_ID`] || "";
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`] || "";

  if (!clientId || !clientSecret) {
    throw new Error(
      `${providerConfig.displayName} OAuth 未配置。请在 .env 中设置 ${prefix}_CLIENT_ID 和 ${prefix}_CLIENT_SECRET。`,
    );
  }

  const redirectUri = `${origin}/api/oauth/callback/${provider}`;

  return { clientId, clientSecret, redirectUri, providerConfig };
}

/**
 * 构造授权 URL
 */
export function buildAuthorizeUrl(
  provider: string,
  oauthCfg: ProviderOAuthConfig,
  state: string,
): string {
  const { providerConfig, clientId, redirectUri } = oauthCfg;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
  });

  if (providerConfig.scope) {
    params.set("scope", providerConfig.scope);
  }

  // 额外参数（如 Jira 的 audience）
  if (providerConfig.extraAuthorizeParams) {
    for (const [k, v] of Object.entries(providerConfig.extraAuthorizeParams)) {
      params.set(k, v);
    }
  }

  return `${providerConfig.authorizeUrl}?${params.toString()}`;
}

/**
 * 用授权码交换 access token
 *
 * 支持两种认证方式：
 * - body（默认）：client_id/client_secret 放请求体
 * - basic：client_id:client_secret base64 编码放 Authorization header（Notion 用此方式）
 *
 * special provider（飞书/企业微信）非标准流程，暂抛错提示后续适配。
 */
export async function exchangeCodeForToken(
  provider: string,
  oauthCfg: ProviderOAuthConfig,
  code: string,
): Promise<string> {
  const { providerConfig, clientId, clientSecret, redirectUri } = oauthCfg;

  if (providerConfig.special) {
    throw new Error(
      `${providerConfig.displayName} 的 OAuth 流程非标准 authorization code flow，暂未实现自动连接。请后续单独适配。`,
    );
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const body: Record<string, string> = {
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  };

  let bodyStr: string;

  if (providerConfig.tokenAuthMode === "basic") {
    // Notion: Basic auth，client_id/secret 放 header，不放 body
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    headers["Authorization"] = `Basic ${credentials}`;
    headers["Content-Type"] = "application/json";
    bodyStr = JSON.stringify(body);
  } else {
    // 标准: client_id/client_secret 放 body
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body["client_id"] = clientId;
    body["client_secret"] = clientSecret;
    bodyStr = new URLSearchParams(body).toString();
  }

  const res = await fetch(providerConfig.tokenUrl, {
    method: "POST",
    headers,
    body: bodyStr,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `${providerConfig.displayName} token exchange failed: ${res.status} ${text}`,
    );
  }

  const data = (await res.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (data.error) {
    throw new Error(
      `${providerConfig.displayName} OAuth error: ${data.error_description || data.error}`,
    );
  }

  if (!data.access_token) {
    throw new Error(`${providerConfig.displayName} OAuth: no access_token in response`);
  }

  return data.access_token;
}
