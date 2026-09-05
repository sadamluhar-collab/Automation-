import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const PORT=Number(process.env.PORT||10000);
const API_BASE=(process.env.API_BASE_URL||'').replace(/\/$/,'');
if(!API_BASE) console.warn('API_BASE_URL is not configured');
const root=path.dirname(fileURLToPath(import.meta.url));
const publicDir=path.join(root,'public');
const allowed=new Set(['/health','/api/realtime-config','/api/auth/login','/api/internet-status','/api/channels','/api/projects','/api/jobs','/api/pipeline/runs','/api/faults','/api/analytics','/api/analytics/channels','/api/artifacts','/api/memory','/api/schedules']);
const send=(res,status,data)=>{res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(data));};
const readBody=async req=>{let s='';for await(const c of req)s+=c;return s};
const proxy=async(req,res,url)=>{
  if(!API_BASE)return send(res,503,{success:false,error:{code:'API_BASE_MISSING',message:'Monitoring API is not configured'}});
  const target=new URL(url,API_BASE); const headers={};
  if(req.headers.authorization)headers.authorization=req.headers.authorization;
  if(req.headers['content-type'])headers['content-type']=req.headers['content-type'];
  const options={method:req.method,headers};
  if(req.method!=='GET'&&req.method!=='HEAD')options.body=await readBody(req);
  const r=await fetch(target,options);
  const body=await r.text(); res.statusCode=r.status; res.setHeader('content-type',r.headers.get('content-type')||'application/json');res.setHeader('cache-control','no-store');res.end(body);
};
const login=async(req,res)=>{
  if(!API_BASE)return send(res,503,{success:false,error:{code:'API_BASE_MISSING',message:'Monitoring API is not configured'}});
  const body=JSON.parse(await readBody(req)||'{}');
  if(typeof body.email!=='string'||typeof body.password!=='string'||!body.email.trim()||!body.password)return send(res,400,{success:false,error:{code:'INVALID_LOGIN_INPUT',message:'Email and password are required'}});
  const cfg=await fetch(`${API_BASE}/api/realtime-config`).then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok||!d.url||!d.anon_key)throw new Error('Supabase authentication is not configured');return d});
  const r=await fetch(`${cfg.url}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:cfg.anon_key,'content-type':'application/json'},body:JSON.stringify({email:body.email.trim(),password:body.password})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.access_token)return send(res,r.status>=400&&r.status<500?r.status:502,{success:false,error:{code:'AUTH_LOGIN_FAILED',message:d.msg||d.error_description||d.message||'Sign in failed'}});
  return send(res,200,{success:true,session:d});
};
const server=http.createServer(async(req,res)=>{
  try{
    const u=new URL(req.url,`http://${req.headers.host||'localhost'}`);
    if(u.pathname==='/health'){return send(res,200,{success:true,status:'ok',service:'monitor-ui'});}
    if(u.pathname.startsWith('/api/')){
      if(![...allowed].some(p=>u.pathname===p||u.pathname.startsWith(`${p}/`)))return send(res,403,{success:false,error:{code:'MONITOR_READ_ONLY',message:'Monitoring UI is read-only'}});
      if(u.pathname==='/api/auth/login'){if(req.method!=='POST')return send(res,405,{success:false,error:{code:'METHOD_NOT_ALLOWED'}});return login(req,res)}
      if(req.method!=='GET')return send(res,403,{success:false,error:{code:'MONITOR_READ_ONLY',message:'Monitoring UI is read-only'}});
      return proxy(req,res,`${u.pathname}${u.search}`);
    }
    if(req.method!=='GET')return send(res,405,{success:false,error:{code:'METHOD_NOT_ALLOWED'}});
    const requested=u.pathname==='/'?'/index.html':u.pathname;
    const safe=path.normalize(requested).replace(/^([.][.][\\/])+/, '');
    const file=path.join(publicDir,safe);
    if(!file.startsWith(publicDir))return send(res,404,{success:false,error:{code:'NOT_FOUND'}});
    const data=await readFile(file); const ext=path.extname(file); const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
    res.statusCode=200;res.setHeader('content-type',types[ext]||'application/octet-stream');res.setHeader('cache-control','no-store');res.end(data);
  }catch(error){console.error(error);send(res,500,{success:false,error:{code:'INTERNAL_ERROR',message:'Monitoring UI error'}})}
});
server.listen(PORT,()=>console.log(`Monitoring UI listening on ${PORT}`));
