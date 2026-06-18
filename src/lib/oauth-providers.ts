/**
 * OAuth Provider 配置表
 *
 * 定义所有支持的数据源 provider 的 OAuth 2.0 配置。
 * 通用 OAuth 路由 /api/oauth/[provider] 根据此表处理授权流程。
 *
 * 注意：github 单独走 /api/oauth/github 静态路由（已实现），不在此表。
 * Next.js 静态路由优先于动态路由，两者互不冲突。
 */

export interface OAuthProviderConfig {
  /** provider 标识，用作 DataSource.name */
  name: string;
  /** 显示名 */
  displayName: string;
  /** 归属插件名（task / calendar / doc） */
  plugin: string;
  /** 授权端点 */
  authorizeUrl: string;
  /** token 交换端点 */
  tokenUrl: string;
  /** OAuth scope */
  scope?: string;
  /** 环境变量前缀，如 JIRA → JIRA_CLIENT_ID / JIRA_CLIENT_SECRET */
  envVarPrefix: string;
  /** token 请求的认证方式：body（默认）/ basic（Notion 用 Basic auth） */
  tokenAuthMode?: "body" | "basic";
  /** 额外的 authorize 参数（如 Jira 的 audience） */
  extraAuthorizeParams?: Record<string, string>;
  /** 是否为非标准 OAuth 流程（飞书/企业微信），暂走通用流程，可能不兼容 */
  special?: boolean;
  /** 文档链接，方便用户注册 OAuth App */
  docsUrl?: string;
}

export const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  // ─── Git 插件 ───
  gitlab: {
    name: "gitlab",
    displayName: "GitLab",
    plugin: "git",
    authorizeUrl: "https://gitlab.com/oauth/authorize",
    tokenUrl: "https://gitlab.com/oauth/token",
    scope: "read_user read_repository",
    envVarPrefix: "GITLAB",
    docsUrl: "https://docs.gitlab.com/ee/api/oauth2.html",
  },

  // ─── Task 插件 ───
  jira: {
    name: "jira",
    displayName: "Jira",
    plugin: "task",
    authorizeUrl: "https://auth.atlassian.com/authorize",
    tokenUrl: "https://auth.atlassian.com/oauth/token",
    scope: "offline_access read:jira-user read:jira-work",
    envVarPrefix: "JIRA",
    extraAuthorizeParams: {
      audience: "api.atlassian.com",
      prompt: "consent",
    },
    docsUrl: "https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/",
  },
  linear: {
    name: "linear",
    displayName: "Linear",
    plugin: "task",
    authorizeUrl: "https://api.linear.app/oauth/authorize",
    tokenUrl: "https://api.linear.app/oauth/token",
    scope: "read",
    envVarPrefix: "LINEAR",
    docsUrl: "https://developers.linear.app/docs/oauth/authentication",
  },
  feishu: {
    name: "feishu",
    displayName: "飞书",
    plugin: "task",
    authorizeUrl: "https://open.feishu.cn/open-apis/authen/v1/authorize",
    tokenUrl: "https://open.feishu.cn/open-apis/authen/v1/oidc/access_token",
    scope: "",
    envVarPrefix: "FEISHU",
    special: true,
    docsUrl: "https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/authen-v1/authorize",
  },

  // ─── Calendar 插件 ───
  google: {
    name: "google",
    displayName: "Google Calendar",
    plugin: "calendar",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/calendar.readonly",
    envVarPrefix: "GOOGLE",
    extraAuthorizeParams: {
      access_type: "offline",
      prompt: "consent",
    },
    docsUrl: "https://developers.google.com/calendar/auth",
  },
  wecom: {
    name: "wecom",
    displayName: "企业微信",
    plugin: "calendar",
    authorizeUrl: "https://open.work.weixin.qq.com/wwopen/sso/qrConnect",
    tokenUrl: "https://qyapi.weixin.qq.com/cgi-bin/user/gettoken",
    scope: "",
    envVarPrefix: "WECOM",
    special: true,
    docsUrl: "https://developer.work.weixin.qq.com/document/path/91022",
  },

  // ─── Doc 插件 ───
  notion: {
    name: "notion",
    displayName: "Notion",
    plugin: "doc",
    authorizeUrl: "https://api.notion.com/v1/oauth/authorize",
    tokenUrl: "https://api.notion.com/v1/oauth/token",
    envVarPrefix: "NOTION",
    tokenAuthMode: "basic",
    docsUrl: "https://developers.notion.com/docs/authorization",
  },
  yuque: {
    name: "yuque",
    displayName: "语雀",
    plugin: "doc",
    authorizeUrl: "https://www.yuque.com/oauth2/authorize",
    tokenUrl: "https://www.yuque.com/oauth2/token",
    scope: "repo.read",
    envVarPrefix: "YUQUE",
    docsUrl: "https://www.yuque.com/yuque/developer/oauth",
  },
};

/**
 * 获取 provider 配置
 */
export function getProviderConfig(name: string): OAuthProviderConfig | undefined {
  return OAUTH_PROVIDERS[name];
}

/**
 * 列出所有 provider，按插件分组
 */
export function listProvidersByPlugin(): Record<string, OAuthProviderConfig[]> {
  const grouped: Record<string, OAuthProviderConfig[]> = {};
  for (const cfg of Object.values(OAUTH_PROVIDERS)) {
    if (!grouped[cfg.plugin]) grouped[cfg.plugin] = [];
    grouped[cfg.plugin].push(cfg);
  }
  return grouped;
}
