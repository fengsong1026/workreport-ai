/**
 * 通用 OAuth 回调端点
 *
 * GET /api/oauth/callback/[provider]?code=...&state=...
 *
 * 1. 验证 state 与 cookie 中的 state 一致（防 CSRF）
 * 2. 用 code 换 access token
 * 3. 将 token 存入 DataSource 表（name = provider 名）
 * 4. 重定向回数据源管理页
 *
 * 注意：github 走专用的 /api/oauth/callback/github 静态路由。
 */

import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForToken,
  getProviderOAuthConfig,
  getRequestOrigin,
} from "@/lib/oauth";
import { getProviderConfig } from "@/lib/oauth-providers";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: { provider: string } },
) {
  // OAuth 回调必须有关联的登录用户
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.redirect(
      new URL("/login?redirect=/data-sources", req.url),
    );
  }

  const provider = params.provider;
  const providerConfig = getProviderConfig(provider);

  if (!providerConfig) {
    return NextResponse.redirect(
      new URL(`/data-sources?error=unknown_provider`, req.url),
    );
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // 用户拒绝授权
  if (error) {
    return NextResponse.redirect(
      new URL(`/data-sources?error=oauth_denied`, req.url),
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL(`/data-sources?error=missing_params`, req.url),
    );
  }

  // 验证 state
  const cookieState = req.cookies.get(`oauth_state_${provider}`)?.value;
  if (!cookieState || cookieState !== state) {
    return NextResponse.redirect(
      new URL(`/data-sources?error=state_mismatch`, req.url),
    );
  }

  try {
    const origin = getRequestOrigin(req);
    const oauthCfg = getProviderOAuthConfig(provider, origin);

    // 换 token
    const token = await exchangeCodeForToken(provider, oauthCfg, code);

    // 存入 DB：每个 provider 一条 DataSource 记录
    const dbConfig = JSON.stringify({
      token,
      connectedAt: new Date().toISOString(),
    });

    await prisma.dataSource.upsert({
      where: { userId_name: { userId: user.id, name: provider } },
      create: {
        name: provider,
        displayName: providerConfig.displayName,
        status: "planned",
        connected: true,
        config: dbConfig,
        userId: user.id,
      },
      update: {
        connected: true,
        config: dbConfig,
      },
    });

    // 清除 state cookie 并重定向
    const response = NextResponse.redirect(
      new URL(`/data-sources?connected=${provider}`, req.url),
    );
    response.cookies.delete(`oauth_state_${provider}`);
    return response;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[!] ${providerConfig.displayName} OAuth 回调失败:`, msg);
    return NextResponse.redirect(
      new URL(
        `/data-sources?error=oauth_failed&msg=${encodeURIComponent(msg)}`,
        req.url,
      ),
    );
  }
}
