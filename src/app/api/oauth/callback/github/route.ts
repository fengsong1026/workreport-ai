/**
 * GitHub OAuth 回调端点
 *
 * GET /api/oauth/callback/github?code=...&state=...
 *
 * 1. 验证 state 与 cookie 中的 state 一致（防 CSRF）
 * 2. 用 code 换 access token
 * 3. 获取用户信息
 * 4. 将 token + 用户信息存入 DataSource 表
 * 5. 重定向回数据源管理页
 */

import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken, getAuthenticatedUser, getGitHubOAuthConfig, getRequestOrigin } from "@/lib/github";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // 用户拒绝授权
  if (error) {
    return NextResponse.redirect(
      new URL("/data-sources?error=oauth_denied", req.url),
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/data-sources?error=missing_params", req.url),
    );
  }

  // 验证 state
  const cookieState = req.cookies.get("github_oauth_state")?.value;
  if (!cookieState || cookieState !== state) {
    return NextResponse.redirect(
      new URL("/data-sources?error=state_mismatch", req.url),
    );
  }

  try {
    const origin = getRequestOrigin(req);
    const { clientId, clientSecret, redirectUri } = getGitHubOAuthConfig(origin);

    // 换 token
    const token = await exchangeCodeForToken(
      code,
      clientId,
      clientSecret,
      redirectUri,
    );

    // 获取用户信息
    const user = await getAuthenticatedUser(token);

    // 存入 DB
    const config = JSON.stringify({
      token,
      user: {
        login: user.login,
        name: user.name,
        email: user.email,
      },
      repos: [],
    });

    await prisma.dataSource.upsert({
      where: { name: "git" },
      create: {
        name: "git",
        displayName: "Git (GitHub)",
        status: "done",
        connected: true,
        config,
      },
      update: {
        connected: true,
        config,
      },
    });

    // 清除 state cookie 并重定向
    const response = NextResponse.redirect(
      new URL("/data-sources?connected=github", req.url),
    );
    response.cookies.delete("github_oauth_state");
    return response;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[!] GitHub OAuth 回调失败:", msg);
    return NextResponse.redirect(
      new URL(`/data-sources?error=oauth_failed&msg=${encodeURIComponent(msg)}`, req.url),
    );
  }
}
