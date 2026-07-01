/**
 * GitHub API 客户端
 *
 * 封装 OAuth 授权码交换、仓库列表、提交记录等 API 调用。
 * 文档：https://docs.github.com/en/rest
 */

import { getRequestOrigin } from "./oauth";

const GITHUB_API = "https://api.github.com";
const GITHUB_OAUTH_AUTHORIZE = "https://github.com/login/oauth/authorize";
const GITHUB_OAUTH_TOKEN = "https://github.com/login/oauth/access_token";

export interface GitHubUser {
  login: string;
  name: string | null;
  email: string | null;
  avatarUrl: string;
}

export interface GitHubRepo {
  id: number;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  pushedAt: string;
  description: string | null;
}

export interface GitHubCommit {
  sha: string;
  message: string;
  authorName: string;
  authorEmail: string;
  authorDate: string;
  authorLogin: string | null;
  htmlUrl: string;
}

/**
 * 构造 GitHub OAuth 授权 URL
 */
export function buildAuthorizeUrl(
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: "repo read:user",
  });
  return `${GITHUB_OAUTH_AUTHORIZE}?${params.toString()}`;
}

/**
 * 用授权码交换 access token
 */
export async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<string> {
  const res = await fetch(GITHUB_OAUTH_TOKEN, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    throw new Error(`GitHub token exchange failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (data.error) {
    throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`);
  }

  if (!data.access_token) {
    throw new Error("GitHub OAuth: no access_token in response");
  }

  return data.access_token;
}

/**
 * 获取已授权用户信息
 */
export async function getAuthenticatedUser(token: string): Promise<GitHubUser> {
  const res = await fetch(`${GITHUB_API}/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!res.ok) {
    throw new Error(`GitHub API /user failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    login: string;
    name: string | null;
    email: string | null;
    avatar_url: string;
  };

  return {
    login: data.login,
    name: data.name,
    email: data.email,
    avatarUrl: data.avatar_url,
  };
}

/**
 * 列出当前用户的所有仓库（owner + collaborator）
 */
export async function listUserRepos(token: string): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  let page = 1;
  const perPage = 100;

  // 最多拉取 5 页（500 个仓库），避免极端情况
  while (page <= 5) {
    const url = new URL(`${GITHUB_API}/user/repos`);
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("page", String(page));
    url.searchParams.set("sort", "pushed");
    url.searchParams.set("affiliation", "owner,collaborator");

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!res.ok) {
      throw new Error(`GitHub API /user/repos failed: ${res.status}`);
    }

    const data = (await res.json()) as Array<{
      id: number;
      full_name: string;
      private: boolean;
      default_branch: string;
      pushed_at: string;
      description: string | null;
    }>;

    if (data.length === 0) break;

    for (const r of data) {
      repos.push({
        id: r.id,
        fullName: r.full_name,
        private: r.private,
        defaultBranch: r.default_branch,
        pushedAt: r.pushed_at,
        description: r.description,
      });
    }

    if (data.length < perPage) break;
    page++;
  }

  return repos;
}

/**
 * 列出某仓库在时间区间内的提交
 *
 * @param authorLogin 可选，按 GitHub login 过滤作者
 */
export async function listCommits(
  token: string,
  owner: string,
  repo: string,
  since: Date,
  until: Date,
  authorLogin?: string,
): Promise<GitHubCommit[]> {
  const commits: GitHubCommit[] = [];
  let page = 1;
  const perPage = 100;

  // 最多拉取 10 页（1000 条），覆盖活跃仓库的足够范围
  while (page <= 10) {
    const url = new URL(`${GITHUB_API}/repos/${owner}/${repo}/commits`);
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("page", String(page));
    url.searchParams.set("since", since.toISOString());
    url.searchParams.set("until", until.toISOString());
    if (authorLogin) {
      url.searchParams.set("author", authorLogin);
    }

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (res.status === 409) {
      // 409 Conflict — 空仓库
      return [];
    }
    if (res.status === 401) {
      throw new Error("GitHub token 已过期或已撤销，请在数据源页面重新连接 GitHub");
    }
    if (res.status === 403) {
      throw new Error("GitHub API 请求频率超限，请稍后再试");
    }
    if (!res.ok) {
      console.error(`[!] GitHub API /repos/${owner}/${repo}/commits failed: ${res.status}`);
      return [];
    }

    const data = (await res.json()) as Array<{
      sha: string;
      commit: {
        author: { name: string; email: string; date: string };
        message: string;
      };
      author: { login: string } | null;
      html_url: string;
    }>;

    if (data.length === 0) break;

    for (const c of data) {
      commits.push({
        sha: c.sha,
        message: c.commit.message,
        authorName: c.commit.author.name,
        authorEmail: c.commit.author.email,
        authorDate: c.commit.author.date,
        authorLogin: c.author?.login ?? null,
        htmlUrl: c.html_url,
      });
    }

    if (data.length < perPage) break;
    page++;
  }

  return commits;
}

/**
 * 从环境变量获取 GitHub OAuth 配置
 *
 * GITHUB_REDIRECT_URI 支持两种形式：
 * - 完整 URL（向后兼容）：http://localhost:8907/api/oauth/callback/github
 * - 仅 path（推荐）：/api/oauth/callback/github
 *   path 模式下需传入 origin 参数，运行时动态拼接，避免写死域名/端口，
 *   本地、服务器、任意域名都不用改配置。
 */
export function getGitHubOAuthConfig(origin?: string) {
  const clientId = process.env.GITHUB_CLIENT_ID || "";
  const clientSecret = process.env.GITHUB_CLIENT_SECRET || "";
  const redirectUriConfig = process.env.GITHUB_REDIRECT_URI || "";

  if (!clientId || !clientSecret) {
    throw new Error(
      "GitHub OAuth 未配置。请在 .env 中设置 GITHUB_CLIENT_ID 和 GITHUB_CLIENT_SECRET。",
    );
  }
  if (!redirectUriConfig) {
    throw new Error(
      "GitHub OAuth 回调地址未配置。请在 .env 中设置 GITHUB_REDIRECT_URI。",
    );
  }

  // 完整 URL 直接用（向后兼容老配置）
  const isAbsoluteUrl = /^https?:\/\//i.test(redirectUriConfig);
  let redirectUri: string;
  if (isAbsoluteUrl) {
    redirectUri = redirectUriConfig;
  } else {
    if (!origin) {
      throw new Error(
        "GITHUB_REDIRECT_URI 配置为 path 模式时，必须传入请求 origin。",
      );
    }
    const path = redirectUriConfig.startsWith("/")
      ? redirectUriConfig
      : `/${redirectUriConfig}`;
    redirectUri = `${origin}${path}`;
  }

  return { clientId, clientSecret, redirectUri };
}
