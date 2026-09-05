import crypto from 'node:crypto';

const send = (res, status, data, headers = {}) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(data));
};

const read = async req => {
  let s = '';
  for await (const c of req) s += c;
  return s ? JSON.parse(s) : {};
};

const form = async req => {
  let s = '';
  for await (const c of req) s += c;
  return new URLSearchParams(s);
};

const base = () => process.env.APP_BASE_URL || `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost'}`;
const token = () => crypto.randomBytes(32).toString('base64url');
const clients = new Map();
const codes = new Map();
const flows = new Map();

const redirectOk = value => {
  try {
    const u = new URL(value);
    return (u.protocol === 'https:' && u.hostname === 'chatgpt.com' &&
      (u.pathname === '/connector_platform_oauth_redirect' || u.pathname.startsWith('/connector/oauth/'))) ||
      (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1') && u.port === '3000' && u.pathname === '/');
  } catch {
    return false;
  }
};

const bearer = req => {
  const value = req.headers.authorization || '';
  if (!value.startsWith('Bearer ')) throw Object.assign(new Error('Authentication required'), { status: 401 });
  return value;
};

const api = async (req, path, method = 'GET', body) => {
  const authorization = bearer(req);
  if (!path.startsWith('/api/')) throw Object.assign(new Error('Only /api routes are permitted'), { status: 400 });
  if (/^\/api\/(auth|oauth|mcp\/admin|secrets)/i.test(path)) throw Object.assign(new Error('Protected internal route'), { status: 403 });
  const response = await fetch(`http://127.0.0.1:${process.env.PORT || 10000}${path}`, {
    method,
    headers: { authorization, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!response.ok) throw Object.assign(new Error(data?.error?.message || `API ${response.status}`), { status: response.status });
  return data;
};

const requireWorkspace = async req => {
  const data = await api(req, '/api/channels');
  if (!Array.isArray(data?.data) || data.data.length === 0) {
    throw Object.assign(new Error('MCP is authenticated to an account with no connected YouTube channel. Reauthorize MCP with the connected YouTube account.'), { status: 401 });
  }
  return data;
};

const security = { type: 'oauth2', scopes: ['automation'] };
const tool = (name, description, properties = {}, required = []) => ({
  name,
  description,
  inputSchema: { type: 'object', properties, required },
  securitySchemes: [security]
});

const tools = [
  tool('automation_execute', 'Full authenticated read/write access to the YouTube Automation API. Tenant ownership and backend authorization remain enforced.', {
    method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
    path: { type: 'string', description: 'API path beginning with /api/' },
    body: { type: 'object' },
    query: { type: 'object' }
  }, ['method', 'path']),
  tool('automation_read', 'Read any authenticated automation API resource.', { path: { type: 'string' }, query: { type: 'object' } }, ['path']),
  tool('automation_write', 'Create, update, control, retry, regenerate, pause, resume, stop, cancel or otherwise mutate any authenticated automation API resource.', {
    method: { type: 'string', enum: ['POST', 'PUT', 'PATCH', 'DELETE'] },
    path: { type: 'string' },
    body: { type: 'object' }
  }, ['method', 'path']),
  tool('list_channels', 'List YouTube channels available to the authenticated user.'),
  tool('list_projects', 'List automation projects available to the authenticated user.'),
  tool('create_project', 'Create a YouTube Automation project.', {
    name: { type: 'string' },
    channel_id: { type: 'string' },
    mode: { type: 'string', enum: ['manual', 'auto'] },
    config: { type: 'object' }
  }, ['name', 'channel_id']),
  tool('delete_project', 'Delete an owned automation project when backend permits it.', { project_id: { type: 'string' } }, ['project_id']),
  tool('create_short', 'Create/start a Short without UI dependency.', {
    project_id: { type: 'string' },
    prompt: { type: 'string' },
    schedule_at: { type: 'string' },
    idempotency_key: { type: 'string' }
  }),
  tool('start_project', 'Start an automation project.', { project_id: { type: 'string' } }, ['project_id']),
  tool('get_job_status', 'Get automation job status.', { job_id: { type: 'string' } }, ['job_id']),
  tool('get_pipeline_status', 'Get pipeline status.', { pipeline_run_id: { type: 'string' } }, ['pipeline_run_id']),
  tool('retry_job', 'Retry an automation job.', { job_id: { type: 'string' } }, ['job_id']),
  tool('create_schedule', 'Create a publishing schedule.', {
    name: { type: 'string' }, channel_id: { type: 'string' }, project_id: { type: 'string' },
    publish_at: { type: 'string' }, timezone: { type: 'string' }, schedule_type: { type: 'string' },
    cron_expression: { type: 'string' }, payload: { type: 'object' }, enabled: { type: 'boolean' }
  }, ['project_id', 'publish_at']),
  tool('channel_analytics', 'Read channel analytics.', { channel_id: { type: 'string' }}),
  tool('list_memory', 'Read channel/project memory.')
];

const render = (res, status, payload) => send(res, status, payload);
const html = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(body);
};
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function authorize(req, res, url) {
  const p = url.searchParams;
  const clientId = p.get('client_id');
  const redirectUri = p.get('redirect_uri');
  const state = p.get('state') || '';
  const challenge = p.get('code_challenge');
  if (!clientId || !redirectUri || !redirectOk(redirectUri) || p.get('response_type') !== 'code' || p.get('code_challenge_method') !== 'S256' || !challenge) {
    return send(res, 400, { error: 'invalid_request', error_description: 'Invalid OAuth/PKCE request' });
  }
  if (clients.has(clientId) && !clients.get(clientId).redirect_uris.includes(redirectUri)) {
    return send(res, 400, { error: 'invalid_request', error_description: 'Invalid redirect_uri' });
  }
  clients.set(clientId, clients.get(clientId) || { redirect_uris: [redirectUri] });
  const flow = token();
  flows.set(flow, { clientId, redirectUri, state, challenge, created: Date.now() });
  setTimeout(() => flows.delete(flow), 600000);
  return html(res, 200, `<!doctype html><meta name="viewport" content="width=device-width"><h2>YouTube Automation</h2><p>Sign in to authorize automation.</p><form method="post" action="${base()}/oauth/authorize?flow=${encodeURIComponent(flow)}"><input name="email" type="email" placeholder="Email" required><input name="password" type="password" placeholder="Password" required><button>Authorize</button></form>`);
}

async function login(req, res, flowId) {
  const flow = flows.get(flowId);
  const body = await form(req);
  if (!flow || Date.now() - flow.created > 600000) return html(res, 400, 'Authorization expired');
  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: process.env.SUPABASE_ANON_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email: body.get('email'), password: body.get('password') })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) return html(res, 401, `Authorization failed: ${esc(data.error_description || data.msg || 'Supabase login failed')}`);
  flows.delete(flowId);
  const code = token();
  codes.set(code, { ...flow, access: data.access_token, refresh: data.refresh_token, expires: data.expires_in || 3600 });
  setTimeout(() => codes.delete(code), 600000);
  const out = new URL(flow.redirectUri);
  out.searchParams.set('code', code);
  if (flow.state) out.searchParams.set('state', flow.state);
  out.searchParams.set('iss', base());
  return res.writeHead(302, { location: out.toString() }).end();
}

async function oauthToken(req, res) {
  const p = await form(req);
  if (p.get('grant_type') === 'authorization_code') {
    const code = codes.get(p.get('code'));
    if (!code || code.clientId !== p.get('client_id') || code.redirectUri !== p.get('redirect_uri')) return send(res, 400, { error: 'invalid_grant' });
    const verifierHash = crypto.createHash('sha256').update(p.get('code_verifier') || '').digest('base64url');
    if (verifierHash !== code.challenge) return send(res, 400, { error: 'invalid_grant' });
    codes.delete(p.get('code'));
    return send(res, 200, { access_token: code.access, refresh_token: code.refresh, token_type: 'Bearer', expires_in: code.expires, scope: 'openid email automation' });
  }
  if (p.get('grant_type') === 'refresh_token') {
    const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: process.env.SUPABASE_ANON_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: p.get('refresh_token') })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return send(res, 400, { error: 'invalid_grant', error_description: data.error_description || data.msg });
    return send(res, 200, { access_token: data.access_token, refresh_token: data.refresh_token, token_type: 'Bearer', expires_in: data.expires_in || 3600, scope: 'openid email automation' });
  }
  return send(res, 400, { error: 'unsupported_grant_type' });
}

const queryString = query => new URLSearchParams(Object.entries(query || {}).filter(([, value]) => value !== undefined && value !== null).map(([key, value]) => [key, String(value)])).toString();

async function callTool(req, name, args) {
  switch (name) {
    case 'automation_execute': {
      await requireWorkspace(req);
      const q = queryString(args.query);
      return api(req, args.path + (q ? `?${q}` : ''), args.method, args.body);
    }
    case 'automation_read': {
      await requireWorkspace(req);
      const q = queryString(args.query);
      return api(req, args.path + (q ? `?${q}` : ''));
    }
    case 'automation_write':
      await requireWorkspace(req);
      return api(req, args.path, args.method, args.body);
    case 'list_channels':
      return requireWorkspace(req);
    case 'list_projects':
      await requireWorkspace(req);
      return api(req, '/api/projects');
    case 'create_project':
      await requireWorkspace(req);
      return api(req, '/api/projects', 'POST', { name: args.name, channel_id: args.channel_id, mode: args.mode || 'manual', config: args.config || {} });
    case 'delete_project':
      await requireWorkspace(req);
      return api(req, `/api/projects/${encodeURIComponent(args.project_id)}`, 'DELETE');
    case 'create_short':
      await requireWorkspace(req);
      return api(req, '/api/automation/dispatch', 'POST', { project_id: args.project_id, prompt: args.prompt, schedule_at: args.schedule_at, idempotency_key: args.idempotency_key });
    case 'start_project':
      await requireWorkspace(req);
      return api(req, `/api/projects/${encodeURIComponent(args.project_id)}/run`, 'POST', {});
    case 'get_job_status':
      await requireWorkspace(req);
      return api(req, `/api/jobs/${encodeURIComponent(args.job_id)}`);
    case 'get_pipeline_status':
      await requireWorkspace(req);
      return api(req, `/api/pipeline/${encodeURIComponent(args.pipeline_run_id)}`);
    case 'retry_job':
      await requireWorkspace(req);
      return api(req, `/api/jobs/${encodeURIComponent(args.job_id)}/retry`, 'POST', {});
    case 'create_schedule':
      await requireWorkspace(req);
      return api(req, '/api/schedules', 'POST', args);
    case 'channel_analytics':
      await requireWorkspace(req);
      return api(req, `/api/channels/${encodeURIComponent(args.channel_id)}/analytics`);
    case 'list_memory':
      await requireWorkspace(req);
      return api(req, '/api/memory');
    default:
      throw Object.assign(new Error(`Unknown tool: ${name}`), { status: 404 });
  }
}

export async function handleMcp(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname === '/.well-known/oauth-protected-resource' || url.pathname === '/mcp/.well-known/oauth-protected-resource') {
      return send(res, 200, { resource: `${base()}/mcp`, authorization_servers: [base()], bearer_methods_supported: ['header'], scopes_supported: ['openid', 'email', 'automation'] });
    }
    if (url.pathname === '/.well-known/oauth-authorization-server' || url.pathname === '/oauth/.well-known/oauth-authorization-server' || url.pathname === '/mcp/.well-known/oauth-authorization-server') {
      return send(res, 200, { issuer: base(), authorization_endpoint: `${base()}/oauth/authorize`, token_endpoint: `${base()}/oauth/token`, registration_endpoint: `${base()}/register`, scopes_supported: ['openid', 'email', 'automation', 'offline_access'], response_types_supported: ['code'], grant_types_supported: ['authorization_code', 'refresh_token'], code_challenge_methods_supported: ['S256'], token_endpoint_auth_methods_supported: ['none'] });
    }
    if (url.pathname === '/register' && req.method === 'POST') {
      const body = await read(req);
      const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];
      if (!redirectUris.length || redirectUris.some(value => !redirectOk(value))) return send(res, 400, { error: 'invalid_client_metadata' });
      const clientId = `chatgpt-${token()}`;
      clients.set(clientId, { redirect_uris: redirectUris });
      return send(res, 201, { client_id: clientId, client_secret_expires_at: 0, redirect_uris: redirectUris, token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] });
    }
    if (url.pathname === '/oauth/authorize' && (req.method === 'GET' || req.method === 'POST')) return req.method === 'POST' && url.searchParams.get('flow') ? login(req, res, url.searchParams.get('flow')) : authorize(req, res, url);
    if (url.pathname === '/oauth/token' && req.method === 'POST') return oauthToken(req, res);
    if (url.pathname === '/mcp' && req.method === 'GET') return send(res, 200, { name: 'youtube-automation', version: '2.1.0', protocol: '2025-06-18', transports: ['streamable-http', 'json'] });

    const body = await read(req);
    const id = body.id ?? null;
    if (body.method === 'initialize') return render(res, 200, { jsonrpc: '2.0', id, result: { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'youtube-automation', version: '2.1.0' } } });
    if (body.method === 'notifications/initialized') return res.writeHead(202).end();
    if (body.method === 'ping') return render(res, 200, { jsonrpc: '2.0', id, result: {} });
    if (body.method === 'tools/list') return render(res, 200, { jsonrpc: '2.0', id, result: { tools } });
    if (body.method === 'tools/call') {
      try {
        const result = await callTool(req, body.params?.name, body.params?.arguments || {});
        return render(res, 200, { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result } });
      } catch (error) {
        if (error.status === 401) {
          return render(res, 401, { jsonrpc: '2.0', id, error: { code: -32001, message: error.message || 'Authentication required' } }, { 'WWW-Authenticate': `Bearer realm="youtube-automation", resource_metadata="${base()}/.well-known/oauth-protected-resource", scope="automation"` });
        }
        return render(res, error.status || 500, { jsonrpc: '2.0', id, error: { code: -32000, message: error.message || 'Tool failed' } });
      }
    }
    return render(res, 404, { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } });
  } catch (error) {
    return send(res, error.status || 500, { jsonrpc: '2.0', id: null, error: { code: -32000, message: error.message || 'Internal error' } });
  }
}
