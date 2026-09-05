import crypto from 'node:crypto';

const send=(res,status,data,headers={})=>{res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');for(const[k,v]of Object.entries(headers))res.setHeader(k,v);res.end(JSON.stringify(data))};
const form=async req=>{let s='';for await(const c of req)s+=c;return new URLSearchParams(s)};
const read=async req=>{let s='';for await(const c of req)s+=c;return s?JSON.parse(s):{}};
const base=()=>process.env.APP_BASE_URL||`https://${process.env.RENDER_EXTERNAL_HOSTNAME||'localhost'}`;
const allowedRedirect=u=>{try{const x=new URL(u);if(x.protocol==='https:'&&x.hostname==='chatgpt.com'&&(x.pathname==='/connector_platform_oauth_redirect'||x.pathname.startsWith('/connector/oauth/')))return true;return (x.protocol==='http:'&&x.hostname==='localhost'&&x.port==='3000'&&x.pathname==='/')||(x.protocol==='http:'&&x.hostname==='127.0.0.1'&&x.port==='3000'&&x.pathname==='/')}catch{return false}};
const clients=new Map(),codes=new Map(),googleFlows=new Map();
const token=()=>crypto.randomBytes(32).toString('base64url');
const verifier=()=>crypto.randomBytes(32).toString('base64url');
const challenge=v=>crypto.createHash('sha256').update(v).digest('base64url');
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
  const p=u.searchParams;const clientId=p.get('client_id'),redirect=p.get('redirect_uri');const client=clients.get(clientId);
  if(!clientId||!redirect||!allowedRedirect(redirect))return send(res,400,{error:'invalid_request',error_description:'Invalid OAuth client or redirect_uri'});
  if(client&&!client.redirect_uris.includes(redirect))return send(res,400,{error:'invalid_request',error_description:'Invalid OAuth client or redirect_uri'});
  if(p.get('response_type')!=='code')return send(res,400,{error:'unsupported_response_type'});
  if(p.get('code_challenge_method')!=='S256'||!p.get('code_challenge'))return send(res,400,{error:'invalid_request',error_description:'PKCE S256 is required'});
  const supabaseUrl=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY;if(!supabaseUrl||!anon)return send(res,500,{error:'server_error',error_description:'Supabase authentication is not configured'});
  if(!client)clients.set(clientId,{redirect_uris:[redirect],client_name:'ChatGPT MCP'});
  const flow=token(),v=verifier();googleFlows.set(flow,{client_id:clientId,redirect_uri:redirect,chatgpt_challenge:p.get('code_challenge'),code_verifier:v,created_at:Date.now()});
  setTimeout(()=>googleFlows.delete(flow),10*60*1000);
  const callback=`${base()}/oauth/google/callback`;
  const q=new URLSearchParams({provider:'google',redirect_to:callback,code_challenge:challenge(v),code_challenge_method:'S256',state:flow});
  return res.writeHead(302,{location:`${supabaseUrl}/auth/v1/authorize?${q}`}).end();
}

async function oauthGoogleCallback(req,res,u){
  const state=u.searchParams.get('state'),code=u.searchParams.get('code'),flow=googleFlows.get(state);
  if(!flow||Date.now()-flow.created_at>10*60*1000)return html(res,400,'<!doctype html><html><body><h2>Authorization failed</h2><p>Invalid or expired OAuth state.</p></body></html>');
  if(u.searchParams.get('error'))return html(res,401,`<!doctype html><html><body><h2>Authorization failed</h2><p>${esc(u.searchParams.get('error_description')||u.searchParams.get('error'))}</p></body></html>`);
  if(!code)return html(res,400,'<!doctype html><html><body><h2>Authorization failed</h2><p>No authorization code returned.</p></body></html>');
  const supabaseUrl=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY;
  const r=await fetch(`${supabaseUrl}/auth/v1/token?grant_type=pkce`,{method:'POST',headers:{apikey:anon,'content-type':'application/json'},body:new URLSearchParams({auth_code:code,code_verifier:flow.code_verifier})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.access_token)return html(res,401,`<!doctype html><html><body><h2>Authorization failed</h2><p>${esc(d.error_description||d.msg||'Google authentication could not be completed.')}</p></body></html>`);
  googleFlows.delete(state);
  const outCode=token();codes.set(outCode,{client_id:flow.client_id,redirect_uri:flow.redirect_uri,challenge:flow.chatgpt_challenge,access_token:d.access_token,refresh_token:d.refresh_token,expires_in:d.expires_in||3600,expires_at:Date.now()+10*60*1000});
  setTimeout(()=>codes.delete(outCode),10*60*1000);
  const out=new URL(flow.redirect_uri);out.searchParams.set('code',outCode);return res.writeHead(302,{location:out.toString()}).end();
}

async function oauthToken(req,res){
  const p=req.method==='POST'?await form(req):new URLSearchParams();const grant=p.get('grant_type'),clientId=p.get('client_id');
  if(grant==='authorization_code'){
    const c=codes.get(p.get('code'));if(!c||c.expires_at<Date.now()||c.client_id!==clientId||c.redirect_uri!==p.get('redirect_uri'))return send(res,400,{error:'invalid_grant',error_description:'Invalid or expired authorization code'});
    const verifierValue=p.get('code_verifier');const computed=crypto.createHash('sha256').update(verifierValue||'').digest('base64url');if(computed!==c.challenge)return send(res,400,{error:'invalid_grant',error_description:'Invalid code_verifier'});
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
    if(u.pathname==='/register'&&req.method==='POST'){const b=await read(req);const redirects=Array.isArray(b.redirect_uris)?b.redirect_uris:[];if(!redirects.length||redirects.some(x=>!allowedRedirect(x)))return send(res,400,{error:'invalid_client_metadata',error_description:'Only approved ChatGPT redirect URIs are allowed'});const id=`chatgpt-${token()}`;clients.set(id,{redirect_uris:redirects,client_name:b.client_name||'ChatGPT MCP'});return send(res,201,{client_id:id,client_id_issued_at:Math.floor(Date.now()/1000),client_secret_expires_at:0,redirect_uris:redirects,token_endpoint_auth_method:'none',grant_types:['authorization_code','refresh_token'],response_types:['code']});}
    if(u.pathname==='/oauth/authorize'&&req.method==='GET')return oauthAuthorize(req,res,u);
    if(u.pathname==='/oauth/google/callback'&&req.method==='GET')return oauthGoogleCallback(req,res,u);
    if(u.pathname==='/oauth/token'&&req.method==='POST')return oauthToken(req,res);
    if(u.pathname==='/mcp'&&req.method==='GET')return send(res,200,{name:'youtube-automation',version:'1.2.0',protocol:'2025-06-18'});
    const b=await read(req),id=b.id??null;
    if(b.method==='initialize')return send(res,200,{jsonrpc:'2.0',id,result:{protocolVersion:'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'youtube-automation',version:'1.2.0'}}});
    if(b.method==='notifications/initialized')return res.writeHead(202).end();
    if(b.method==='ping')return send(res,200,{jsonrpc:'2.0',id,result:{}});
    if(b.method==='tools/list')return send(res,200,{jsonrpc:'2.0',id,result:{tools}});
    if(b.method==='tools/call'){const d=await tool(req,b.params?.name,b.params?.arguments||{});return send(res,200,{jsonrpc:'2.0',id,result:{content:[{type:'text',text:JSON.stringify(d)}],structuredContent:d}})}
    return send(res,200,{jsonrpc:'2.0',id,error:{code:-32601,message:'Method not found'}});
  }catch(e){return send(res,e.status||500,{jsonrpc:'2.0',id:null,error:{code:-32000,message:e.message||'Internal error'}})}
}

async function tool(req,n,a){switch(n){case'list_channels':return api(req,'/api/channels');case'list_projects':return api(req,'/api/projects');case'start_project':return api(req,`/api/projects/${encodeURIComponent(a.project_id)}/run`,'POST',{});case'get_job_status':return api(req,`/api/jobs/${encodeURIComponent(a.job_id)}`);case'get_pipeline_status':return api(req,`/api/pipeline/runs/${encodeURIComponent(a.pipeline_run_id)}`);case'retry_job':return api(req,`/api/jobs/${encodeURIComponent(a.job_id)}`,'POST',{command:'RETRY'});case'create_schedule':return api(req,'/api/schedules','POST',a);case'channel_analytics':return api(req,`/api/analytics/channels${a.channel_id?`?channel_id=${encodeURIComponent(a.channel_id)}`:''}`);case'list_memory':return api(req,'/api/memory');default:throw Object.assign(new Error('Unknown tool'),{status:400})}}