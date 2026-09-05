import crypto from 'node:crypto';

const send=(res,status,data,headers={})=>{res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');for(const[k,v]of Object.entries(headers))res.setHeader(k,v);res.end(JSON.stringify(data))};
const read=async req=>{let s='';for await(const c of req)s+=c;return s?JSON.parse(s):{}};
const form=async req=>{let s='';for await(const c of req)s+=c;return new URLSearchParams(s)};
const base=()=>process.env.APP_BASE_URL||`https://${process.env.RENDER_EXTERNAL_HOSTNAME||'localhost'}`;
const allowedRedirect=u=>{try{const x=new URL(u);return x.protocol==='https:'&&x.hostname==='chatgpt.com'&&(x.pathname==='/connector_platform_oauth_redirect'||x.pathname.startsWith('/connector/oauth/'))}catch{return false}};
const clients=new Map(),codes=new Map();
const token=()=>crypto.randomBytes(32).toString('base64url');
const html=(res,status,body)=>{res.statusCode=status;res.setHeader('content-type','text/html; charset=utf-8');res.setHeader('cache-control','no-store');res.end(body)};
const esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

const tools=[
{name:'list_channels',description:'List YouTube channels available to the authenticated user.',inputSchema:{type:'object',properties:{}}},
{name:'list_projects',description:'List automation projects available to the authenticated user.',inputSchema:{type:'object',properties:{}}},
{name:'start_project',description:'Start an automation project pipeline.',inputSchema:{type:'object',properties:{project_id:{type:'string'}},required:['project_id']}},
{name:'get_job_status',description:'Get the status of an automation job.',inputSchema:{type:'object',properties:{job_id:{type:'string'}},required:['job_id']}},
{name:'get_pipeline_status',description:'Get the status of a pipeline run.',inputSchema:{type:'object',properties:{pipeline_run_id:{type:'string'}},required:['pipeline_run_id']}},
{name:'retry_job',description:'Retry a failed automation job.',inputSchema:{type:'object',properties:{job_id:{type:'string'}},required:['job_id']}},
{name:'create_schedule',description:'Create a project publishing schedule.',inputSchema:{type:'object',properties:{name:{type:'string'},channel_id:{type:'string'},project_id:{type:'string'},publish_at:{type:'string'},timezone:{type:'string'},schedule_type:{type:'string'},cron_expression:{type:'string'},payload:{type:'object'},enabled:{type:'boolean'}},required:['project_id','publish_at']}},
{name:'channel_analytics',description:'Read channel analytics.',inputSchema:{type:'object',properties:{channel_id:{type:'string'}}}},
{name:'list_memory',description:'Read channel/project memory.',inputSchema:{type:'object',properties:{}}}
];

async function api(req,path,method='GET',body){const a=req.headers.authorization;if(!a?.startsWith('Bearer '))throw Object.assign(new Error('Authentication required'),{status:401});const r=await fetch(`http://127.0.0.1:${process.env.PORT||10000}${path}`,{method,headers:{authorization:a,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const t=await r.text();let d;try{d=JSON.parse(t)}catch{d={raw:t}};if(!r.ok)throw Object.assign(new Error(d?.error?.message||`API ${r.status}`),{status:r.status});return d}

async function oauthAuthorize(req,res,u){
  const p=u.searchParams;const client=clients.get(p.get('client_id'));const redirect=p.get('redirect_uri');
  if(!client||!redirect||!allowedRedirect(redirect)||!client.redirect_uris.includes(redirect))return send(res,400,{error:'invalid_request',error_description:'Invalid OAuth client or redirect_uri'});
  if(p.get('response_type')!=='code')return send(res,400,{error:'unsupported_response_type'});
  if(p.get('code_challenge_method')!=='S256'||!p.get('code_challenge'))return send(res,400,{error:'invalid_request',error_description:'PKCE S256 is required'});
  const fields=['client_id','redirect_uri','response_type','scope','state','code_challenge','code_challenge_method'].map(k=>`<input type="hidden" name="${k}" value="${esc(p.get(k)||'')}">`).join('');
  return html(res,200,`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>YouTube Automation Authorization</title></head><body style="font-family:system-ui;max-width:420px;margin:60px auto;padding:20px"><h2>Connect YouTube Automation</h2><p>Sign in with your Automation account to allow ChatGPT to read and control your automation.</p><form method="post" action="/oauth/authorize">${fields}<label>Email</label><input name="email" type="email" required style="width:100%;padding:10px;margin:6px 0 14px"><label>Password</label><input name="password" type="password" required style="width:100%;padding:10px;margin:6px 0 18px"><button type="submit" style="padding:10px 16px">Authorize</button></form></body></html>`);
}

async function oauthAuthorizePost(req,res){
  const p=await form(req);const client=clients.get(p.get('client_id'));const redirect=p.get('redirect_uri');
  if(!client||!redirect||!allowedRedirect(redirect)||!client.redirect_uris.includes(redirect))return send(res,400,{error:'invalid_request',error_description:'Invalid OAuth client or redirect_uri'});
  if(p.get('code_challenge_method')!=='S256'||!p.get('code_challenge'))return send(res,400,{error:'invalid_request',error_description:'PKCE S256 is required'});
  const supabaseUrl=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY;
  if(!supabaseUrl||!anon)return send(res,500,{error:'server_error',error_description:'Supabase authentication is not configured'});
  const r=await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:anon,'content-type':'application/json'},body:JSON.stringify({email:p.get('email'),password:p.get('password')})});
  const d=await r.json();
  if(!r.ok)return html(res,401,`<!doctype html><html><body style="font-family:system-ui;max-width:420px;margin:60px auto;padding:20px"><h2>Authorization failed</h2><p>${esc(d.error_description||d.msg||'Invalid login credentials')}</p><a href="/oauth/authorize?${new URLSearchParams({client_id:p.get('client_id'),redirect_uri:redirect,response_type:'code',scope:p.get('scope')||'',state:p.get('state')||'',code_challenge:p.get('code_challenge'),code_challenge_method:'S256'})}">Try again</a></body></html>`);
  const code=token();codes.set(code,{client_id:p.get('client_id'),redirect_uri:redirect,challenge:p.get('code_challenge'),access_token:d.access_token,refresh_token:d.refresh_token,expires_in:d.expires_in||3600,expires_at:Date.now()+10*60*1000});
  setTimeout(()=>codes.delete(code),10*60*1000);
  const out=new URL(redirect);out.searchParams.set('code',code);if(p.get('state'))out.searchParams.set('state',p.get('state'));return res.writeHead(302,{location:out.toString()}).end();
}

async function oauthToken(req,res){
  const p=req.method==='POST'?await form(req):new URLSearchParams();const grant=p.get('grant_type'),clientId=p.get('client_id');
  if(grant==='authorization_code'){
    const c=codes.get(p.get('code'));if(!c||c.expires_at<Date.now()||c.client_id!==clientId||c.redirect_uri!==p.get('redirect_uri'))return send(res,400,{error:'invalid_grant',error_description:'Invalid or expired authorization code'});
    const verifier=p.get('code_verifier');const challenge=crypto.createHash('sha256').update(verifier||'').digest('base64url');if(challenge!==c.challenge)return send(res,400,{error:'invalid_grant',error_description:'Invalid code_verifier'});
    codes.delete(p.get('code'));return send(res,200,{access_token:c.access_token,token_type:'Bearer',expires_in:c.expires_in,refresh_token:c.refresh_token,scope:'openid email automation'});
  }
  if(grant==='refresh_token'){
    const refresh=p.get('refresh_token');if(!refresh)return send(res,400,{error:'invalid_request',error_description:'refresh_token required'});
    const supabaseUrl=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY;if(!supabaseUrl||!anon)return send(res,500,{error:'server_error',error_description:'Supabase authentication is not configured'});
    const r=await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:anon,'content-type':'application/json'},body:JSON.stringify({refresh_token:refresh})});const d=await r.json();if(!r.ok)return send(res,400,{error:'invalid_grant',error_description:d.error_description||d.msg||'Refresh failed'});return send(res,200,{access_token:d.access_token,token_type:'Bearer',expires_in:d.expires_in||3600,refresh_token:d.refresh_token||refresh,scope:'openid email automation'});
  }
  return send(res,400,{error:'unsupported_grant_type'});
}

export async function handleMcp(req,res){
  try{
    const u=new URL(req.url,`http://${req.headers.host||'localhost'}`);
    if(u.pathname==='/.well-known/oauth-protected-resource'||u.pathname==='/mcp/.well-known/oauth-protected-resource')return send(res,200,{resource:`${base()}/mcp`,authorization_servers:[base()],bearer_methods_supported:['header']});
    if(u.pathname==='/.well-known/oauth-authorization-server'||u.pathname==='/.well-known/oauth-authorization-server/mcp'||u.pathname==='/mcp/.well-known/oauth-authorization-server')return send(res,200,{issuer:base(),authorization_endpoint:`${base()}/oauth/authorize`,token_endpoint:`${base()}/oauth/token`,registration_endpoint:`${base()}/register`,scopes_supported:['openid','email','automation'],response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],code_challenge_methods_supported:['S256'],token_endpoint_auth_methods_supported:['none']});
    if(u.pathname==='/register'&&req.method==='POST'){const b=await read(req);const redirects=Array.isArray(b.redirect_uris)?b.redirect_uris:[];if(!redirects.length||redirects.some(x=>!allowedRedirect(x)))return send(res,400,{error:'invalid_client_metadata',error_description:'Only approved HTTPS chatgpt.com redirect URIs are allowed'});const id=`chatgpt-${token()}`;clients.set(id,{redirect_uris:redirects,client_name:b.client_name||'ChatGPT MCP'});return send(res,201,{client_id:id,client_id_issued_at:Math.floor(Date.now()/1000),client_secret_expires_at:0,redirect_uris:redirects,token_endpoint_auth_method:'none',grant_types:['authorization_code','refresh_token'],response_types:['code']});}
    if(u.pathname==='/oauth/authorize'&&req.method==='GET')return oauthAuthorize(req,res,u);
    if(u.pathname==='/oauth/authorize'&&req.method==='POST')return oauthAuthorizePost(req,res);
    if(u.pathname==='/oauth/token'&&req.method==='POST')return oauthToken(req,res);
    if(u.pathname==='/mcp'&&req.method==='GET')return send(res,200,{name:'youtube-automation',version:'1.1.0',protocol:'2025-06-18'});
    const b=await read(req),id=b.id??null;
    if(b.method==='initialize')return send(res,200,{jsonrpc:'2.0',id,result:{protocolVersion:'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'youtube-automation',version:'1.1.0'}}});
    if(b.method==='notifications/initialized')return res.writeHead(202).end();
    if(b.method==='ping')return send(res,200,{jsonrpc:'2.0',id,result:{}});
    if(b.method==='tools/list')return send(res,200,{jsonrpc:'2.0',id,result:{tools}});
    if(b.method==='tools/call'){const d=await tool(req,b.params?.name,b.params?.arguments||{});return send(res,200,{jsonrpc:'2.0',id,result:{content:[{type:'text',text:JSON.stringify(d)}],structuredContent:d}})}
    return send(res,200,{jsonrpc:'2.0',id,error:{code:-32601,message:'Method not found'}});
  }catch(e){return send(res,e.status||500,{jsonrpc:'2.0',id:null,error:{code:-32000,message:e.message||'Internal error'}})}
}

async function tool(req,n,a){switch(n){case'list_channels':return api(req,'/api/channels');case'list_projects':return api(req,'/api/projects');case'start_project':return api(req,`/api/projects/${encodeURIComponent(a.project_id)}/run`,'POST',{});case'get_job_status':return api(req,`/api/jobs/${encodeURIComponent(a.job_id)}`);case'get_pipeline_status':return api(req,`/api/pipeline/runs/${encodeURIComponent(a.pipeline_run_id)}`);case'retry_job':return api(req,`/api/jobs/${encodeURIComponent(a.job_id)}`,'POST',{command:'RETRY'});case'create_schedule':return api(req,'/api/schedules','POST',a);case'channel_analytics':return api(req,`/api/analytics/channels${a.channel_id?`?channel_id=${encodeURIComponent(a.channel_id)}`:''}`);case'list_memory':return api(req,'/api/memory');default:throw Object.assign(new Error('Unknown tool'),{status:400})}}
