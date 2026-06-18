/**
 * GitHub OAuth 发起端点
 *
 * GET /api/oauth/github
 *
 * 生成授权 URL 并重定向到 GitHub 授权页。
 * 使用随机 state 防止 CSRF，state 存入 cookie 在回调时验证。
 */

import { NextRequest, NextResponse } from "next/server";
import { buildAuthorizeUrl, getGitHubOAuthConfig } from "@/lib/github";
import { getRequestOrigin } from "@/lib/oauth";
import { randomBytes } from "crypto";

export async function GET(req: NextRequest) {
  try {
    const origin = getRequestOrigin(req);
    const { clientId, redirectUri } = getGitHubOAuthConfig(origin);
    const state = randomBytes(16).toString("hex");

    const authorizeUrl = buildAuthorizeUrl(clientId, redirectUri, state);

    const response = NextResponse.redirect(authorizeUrl);
    // state 存入 cookie，回调时验证
    response.cookies.set("github_oauth_state", state, {
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
