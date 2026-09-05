import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const PORT=Number(process.env.PORT||10000);
const API_BASE=(process.env.API_BASE_URL||'').replace(/\/$/,'');
if(!API_BASE) console.warn('API_BASE_URL is not configured');
const root=path.dirname(fileURLToPath(import.meta.url));
const publicDir=path.join(root,'public');
const allowed=new Set(['/health','/api/realtime-config','/api/internet-status','/api/channels','/api/projects','/api/jobs','/api/pipeline/runs','/api/faults','/api/analytics','/api/analytics/channels','/api/artifacts','/api/memory','/api/schedules']);
const send=(res,status,data)=>{res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(data));};
const proxy=async(req,res,url)=>{
  if(!API_BASE)return send(res,503,{success:false,error:{code:'API_BASE_MISSING',message:'Monitoring API is not configured'}});
  const target=new URL(url,API_BASE); const headers={};
  if(req.headers.authorization)headers.authorization=req.headers.authorization;
  const r=await fetch(target,{method:'GET',headers});
  const body=await r.text(); res.statusCode=r.status; res.setHeader('content-type',r.headers.get('content-type')||'application/json');res.setHeader('cache-control','no-store');res.end(body);
};
const server=http.createServer(async(req,res)=>{
  try{
    const u=new URL(req.url,`http://${req.headers.host||'localhost'}`);
    if(u.pathname==='/health'){return send(res,200,{success:true,status:'ok',service:'monitor-ui'});}
    if(u.pathname.startsWith('/api/')){
      if(req.method!=='GET'||![...allowed].some(p=>u.pathname===p||u.pathname.startsWith(`${p}/`)))return send(res,403,{success:false,error:{code:'MONITOR_READ_ONLY',message:'Monitoring UI is read-only'}});
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
