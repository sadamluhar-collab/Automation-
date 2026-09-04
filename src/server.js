import http from 'node:http';
import {URL} from 'node:url';
import {readFile} from 'node:fs/promises';
import {env} from './config/env.js';
import {requestId} from './api/middleware/request-id.js';
import {rateLimit} from './api/middleware/rate-limit.js';
import {auth,workerAuth} from './api/middleware/auth.js';
import {health} from './api/routes/health.js';
import {internetStatus} from './providers/internet-status.js';
import * as channels from './api/routes/channels.js';
import * as projects from './api/routes/projects.js';
import * as jobs from './api/routes/jobs.js';
import * as commands from './api/routes/commands.js';
import * as pipeline from './api/routes/pipeline.js';
import * as workers from './api/routes/workers.js';
import * as faults from './api/routes/faults.js';
import * as analytics from './api/routes/analytics.js';
import * as settings from './api/routes/settings.js';
import * as youtube from './api/routes/youtube.js';

const e=env(),limit=rateLimit();
const json=async req=>{let s='';for await(const c of req)s+=c;if(!s)return{};return JSON.parse(s)};
const send=(res,status,data)=>{res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(data))};
const mime=p=>p.endsWith('.js')?'text/javascript; charset=utf-8':p.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8';

const server=http.createServer(async(req,res)=>{
  try{
    requestId(req,res,()=>{});
    limit(req,res,()=>{});
    if(res.writableEnded)return;

    const u=new URL(req.url,`http://${req.headers.host||'localhost'}`);
    if(u.pathname==='/health'&&req.method==='GET')return health(req,res);
    if(u.pathname==='/api/realtime-config'&&req.method==='GET')return send(res,200,{success:true,url:e.SUPABASE_URL,anon_key:e.SUPABASE_ANON_KEY});
    if(u.pathname==='/api/internet-status'&&req.method==='GET'){
      const result=await internetStatus();
      return send(res,result.success?200:503,result);
    }

    if(req.method==='GET'&&(u.pathname==='/'||u.pathname.startsWith('/css/')||u.pathname.startsWith('/js/'))){
      const p=u.pathname==='/'?'/index.html':u.pathname;
      const data=await readFile(new URL(`../public${p}`,import.meta.url));
      res.statusCode=200;
      res.setHeader('content-type',mime(p));
      res.setHeader('cache-control','no-store, max-age=0');
      return res.end(data);
    }

    if(u.pathname==='/api/worker/heartbeat')return workerAuth(req,res,()=>send(res,200,{success:true}));
    if(u.pathname==='/api/channels'&&req.method==='GET')return auth(req,res,()=>channels.routes(req,res));
    if(u.pathname==='/api/projects'&&req.method==='GET')return auth(req,res,()=>projects.list(req,res));
    if(u.pathname==='/api/projects'&&req.method==='POST'){req.body=await json(req);return auth(req,res,()=>projects.create(req,res))}
    if(u.pathname.startsWith('/api/projects/')&&req.method==='GET')return auth(req,res,()=>{req.params={id:u.pathname.split('/')[3]};projects.get(req,res)});
    if(u.pathname.startsWith('/api/projects/')&&req.method==='PATCH'){req.body=await json(req);return auth(req,res,()=>{req.params={id:u.pathname.split('/')[3]};projects.update(req,res)})}
    if(u.pathname.startsWith('/api/projects/')&&u.pathname.endsWith('/run')&&req.method==='POST'){req.body=await json(req);return auth(req,res,()=>{req.params={id:u.pathname.split('/')[3]};projects.run(req,res)})}
    if(u.pathname==='/api/jobs'&&req.method==='POST'){req.body=await json(req);return auth(req,res,()=>jobs.create(req,res))}
    if(u.pathname.startsWith('/api/jobs/')&&req.method==='GET')return auth(req,res,()=>{req.params={id:u.pathname.split('/')[3]};jobs.get(req,res)});
    if(u.pathname==='/api/commands'&&req.method==='POST'){req.body=await json(req);return auth(req,res,()=>commands.execute(req,res))}
    if(u.pathname.startsWith('/api/pipeline/')&&req.method==='GET')return auth(req,res,()=>{req.params={step:u.pathname.split('/')[3]};pipeline.inspect(req,res)});
    if(u.pathname==='/api/workers'&&req.method==='GET')return auth(req,res,()=>workers.list(req,res));
    if(u.pathname==='/api/faults'&&req.method==='GET')return auth(req,res,()=>{req.query=Object.fromEntries(u.searchParams);faults.list(req,res)});
    if(u.pathname==='/api/analytics'&&req.method==='GET')return auth(req,res,()=>{req.query=Object.fromEntries(u.searchParams);analytics.list(req,res)});
    if(u.pathname==='/api/settings'&&req.method==='GET')return auth(req,res,()=>settings.get(req,res));
    if(u.pathname==='/api/youtube/connect'&&req.method==='GET')return auth(req,res,()=>youtube.connect(req,res));
    if(u.pathname==='/api/youtube/callback'&&req.method==='GET'){req.query=Object.fromEntries(u.searchParams);return youtube.callback(req,res)}
    if(u.pathname==='/api/youtube/sync'&&req.method==='POST'){req.body=await json(req);return auth(req,res,()=>youtube.sync(req,res))}
    return send(res,404,{success:false,error:{code:'NOT_FOUND',message:'Route not found',request_id:req.requestId}});
  }catch(err){
    console.error(err);
    send(res,err.status||500,{success:false,error:{code:err.code||'INTERNAL_ERROR',message:err.status?err.message:'Internal error',request_id:req.requestId,retryable:Boolean(err.retryable)}})
  }
});

server.listen(e.PORT,()=>console.log(`Automation API listening on ${e.PORT}`));
export default server;
