/**
 * 通用 OAuth 发起端点
 *
 * GET /api/oauth/[provider]
 *
 * 根据路径参数 provider 查找配置表，生成授权 URL 并重定向。
 * 使用随机 state 防止 CSRF，state 存入 cookie 在回调时验证。
 *
 * 注意：github 走专用的 /api/oauth/github 静态路由，不经过此动态路由。
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import {
  buildAuthorizeUrl,
  getProviderOAuthConfig,
  getRequestOrigin,
} from "@/lib/oauth";
import { getProviderConfig } from "@/lib/oauth-providers";

export async function GET(
  req: NextRequest,
  { params }: { params: { provider: string } },
) {
  const provider = params.provider;
  const providerConfig = getProviderConfig(provider);

  if (!providerConfig) {
    return NextResponse.json(
      { error: `未知 OAuth provider: ${provider}` },
      { status: 404 },
    );
  }

  try {
    const origin = getRequestOrigin(req);
    const oauthCfg = getProviderOAuthConfig(provider, origin);
    const state = randomBytes(16).toString("hex");

    const authorizeUrl = buildAuthorizeUrl(provider, oauthCfg, state);

    const response = NextResponse.redirect(authorizeUrl);
    // state 存入 cookie，回调时验证（每个 provider 独立 cookie 名）
    response.cookies.set(`oauth_state_${provider}`, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 分钟
      path: "/",
    });

    return response;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
