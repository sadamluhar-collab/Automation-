import OAuthProvider, {
  OAuthError,
  type OAuthHelpers,
} from "@cloudflare/workers-oauth-provider";
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

type AuthProps = {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

type Env = {
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER: OAuthHelpers;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  RENDER_API_BASE_URL: string;
};

const blockedPath = /^\/api\/(auth|oauth|mcp\/admin|secrets)(?:\/|$)/i;

function cleanPath(path: string) {
  if (!path.startsWith("/api/")) throw new Error("Only /api routes are allowed");
  if (blockedPath.test(path)) throw new Error("Protected internal route");
  return path;
}

async function renderApi(env: Env, props: AuthProps, path: string, method = "GET", body?: unknown) {
  const safePath = cleanPath(path);
  const response = await fetch(`${env.RENDER_API_BASE_URL}${safePath}`, {
    method,
    headers: {
      Authorization: `Bearer ${props.accessToken}`,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error?: { message?: string } }).error?.message ?? `Render API ${response.status}`)
        : `Render API ${response.status}`;
    if (response.status === 401) {
      throw new Error("Render session expired. Reconnect the Cloudflare MCP server to refresh authorization.");
    }
    throw new Error(message);
  }

  return data;
}

async function supabasePasswordLogin(env: Env, email: string, password: string) {
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, any>;
  if (!response.ok || !data.access_token || !data.refresh_token || !data.user?.id) {
    throw new Error(data.error_description || data.msg || "Supabase authentication failed");
  }
  return {
    userId: String(data.user.id),
    email: String(data.user.email || email),
    accessToken: String(data.access_token),
    refreshToken: String(data.refresh_token),
    expiresIn: Number(data.expires_in || 3600),
  } satisfies AuthProps;
}

async function supabaseRefresh(env: Env, refreshToken: string) {
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, any>;
  if (!response.ok || !data.access_token || !data.refresh_token) {
    throw new OAuthError("invalid_grant", {
      description: "The YouTube Automation account session expired. Reconnect the MCP server.",
    });
  }
  return {
    accessToken: String(data.access_token),
    refreshToken: String(data.refresh_token),
    expiresIn: Number(data.expires_in || 3600),
  };
}

function text(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

export class YouTubeAutomationMcp extends McpAgent<Env, Record<string, never>, AuthProps> {
  server = new McpServer({
    name: "YouTube Automation Control",
    version: "1.0.0",
  });

  async init() {
    const props = this.props;

    this.server.tool("whoami", "Show the authenticated YouTube Automation account and verify backend access.", {}, async () => {
      const channels = await renderApi(this.env, props, "/api/channels");
      const projects = await renderApi(this.env, props, "/api/projects");
      return text({ account: props.email, user_id: props.userId, channels, projects });
    });

    this.server.tool("list_channels", "List connected YouTube channels for the authenticated account.", {}, async () => {
      return text(await renderApi(this.env, props, "/api/channels"));
    });

    this.server.tool("list_projects", "List YouTube Automation projects for the authenticated account.", {}, async () => {
      return text(await renderApi(this.env, props, "/api/projects"));
    });

    this.server.tool(
      "create_project",
      "Create a YouTube Automation project owned by the authenticated account.",
      {
        name: z.string().min(1),
        channel_id: z.string().min(1),
        mode: z.enum(["manual", "auto"]).optional(),
        config: z.record(z.string(), z.unknown()).optional(),
      },
      async (args) => text(await renderApi(this.env, props, "/api/projects", "POST", {
        name: args.name,
        channel_id: args.channel_id,
        mode: args.mode || "manual",
        config: args.config || {},
      })),
    );

    this.server.tool(
      "delete_project",
      "Delete an owned project. The backend blocks deletion when active work exists.",
      { project_id: z.string().uuid() },
      async ({ project_id }) => text(await renderApi(this.env, props, `/api/projects/${encodeURIComponent(project_id)}`, "DELETE")),
    );

    this.server.tool(
      "create_short",
      "Create or schedule a Short directly through the backend. UI is not required; project_id can be omitted when the backend can uniquely resolve the eligible project.",
      {
        project_id: z.string().uuid().optional(),
        prompt: z.string().optional(),
        schedule_at: z.string().optional(),
        idempotency_key: z.string().optional(),
      },
      async (args) => text(await renderApi(this.env, props, "/api/automation/dispatch", "POST", {
        project_id: args.project_id,
        prompt: args.prompt,
        schedule_at: args.schedule_at,
        idempotency_key: args.idempotency_key,
      })),
    );

    this.server.tool(
      "start_project",
      "Start a project without UI interaction.",
      { project_id: z.string().uuid() },
      async ({ project_id }) => text(await renderApi(this.env, props, `/api/projects/${encodeURIComponent(project_id)}/run`, "POST", {})),
    );

    this.server.tool(
      "automation_execute",
      "Full authenticated read/write access to permitted /api routes. Tenant ownership and backend authorization remain enforced. Use this for any automation function not covered by a dedicated tool.",
      {
        method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
        path: z.string().startsWith("/api/"),
        query: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
        body: z.unknown().optional(),
      },
      async ({ method, path, query, body }) => {
        const qs = new URLSearchParams();
        for (const [key, value] of Object.entries(query || {})) qs.set(key, String(value));
        const finalPath = `${path}${qs.size ? `?${qs.toString()}` : ""}`;
        return text(await renderApi(this.env, props, finalPath, method, body));
      },
    );
  }
}

function loginPage(query: string, error?: string) {
  const message = error ? `<p style="color:#b91c1c">${error}</p>` : "";
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>YouTube Automation MCP</title></head><body style="font-family:system-ui;max-width:420px;margin:60px auto;padding:20px"><h2>Authorize YouTube Automation</h2><p>Sign in with the YouTube Automation account that owns your connected channel.</p>${message}<form method="post" action="/authorize?${query}"><label>Email</label><input name="email" type="email" required style="display:block;width:100%;margin:8px 0 16px;padding:10px"><label>Password</label><input name="password" type="password" required autocomplete="current-password" style="display:block;width:100%;margin:8px 0 16px;padding:10px"><button type="submit" style="padding:10px 16px">Authorize</button></form></body></html>`, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

const defaultHandler = {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname !== "/authorize") return new Response("Not found", { status: 404 });

    let oauthRequest;
    try {
      oauthRequest = await env.OAUTH_PROVIDER.parseAuthRequest(request);
    } catch {
      return new Response("Invalid OAuth authorization request", { status: 400 });
    }

    if (request.method === "GET") return loginPage(url.searchParams.toString());
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET, POST" } });

    const form = await request.formData();
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    if (!email || !password) return loginPage(url.searchParams.toString(), "Email and password are required.");

    try {
      const session = await supabasePasswordLogin(env, email, password);
      const channelsResponse = await fetch(`${env.RENDER_API_BASE_URL}/api/channels`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      if (!channelsResponse.ok) return loginPage(url.searchParams.toString(), "Automation API authorization failed.");
      const channels = await channelsResponse.json().catch(() => null) as any;
      if (!Array.isArray(channels?.data) || channels.data.length === 0) {
        return loginPage(url.searchParams.toString(), "This account has no connected YouTube channel. Connect YouTube first, then reconnect this MCP.");
      }

      const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
        request: oauthRequest,
        userId: session.userId,
        metadata: { clientName: "YouTube Automation MCP", email: session.email },
        scope: ["automation"],
        props: session,
      });
      return Response.redirect(redirectTo, 302);
    } catch (error) {
      return loginPage(url.searchParams.toString(), error instanceof Error ? error.message : "Authorization failed.");
    }
  },
};

export default new OAuthProvider<Env>({
  apiHandler: YouTubeAutomationMcp.serve("/mcp"),
  apiRoute: "/mcp",
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
  defaultHandler,
  scopesSupported: ["automation"],
  allowPlainPKCE: false,
  resourceMetadata: {
    resource: "https://youtube-automation-mcp.workers.dev/mcp",
    authorization_servers: ["https://youtube-automation-mcp.workers.dev"],
    scopes_supported: ["automation"],
    resource_name: "YouTube Automation MCP",
  },
  tokenExchangeCallback: async ({ grantType, props }) => {
    if (grantType === "refresh_token") {
      const refreshed = await supabaseRefresh((globalThis as any).__env as Env, props.refreshToken);
      return {
        newProps: { ...props, ...refreshed },
        accessTokenProps: { ...props, ...refreshed },
        accessTokenTTL: Math.max(60, refreshed.expiresIn - 30),
      };
    }
    return { accessTokenTTL: Math.max(60, Number(props.expiresIn || 3600) - 30) };
  },
});
