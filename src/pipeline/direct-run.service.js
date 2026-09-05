import {createHash} from 'node:crypto';
import {projects} from '../database/repositories/project.repository.js';
import {channels} from '../database/repositories/channel.repository.js';
import {pipeline} from '../database/repositories/pipeline.repository.js';
import {jobs} from '../database/repositories/job.repository.js';
import {enqueue} from '../queue/queue.service.js';
import {loadYouTubeCredential} from '../auth/youtube-credential.service.js';

const ACTIVE=new Set(['queued','running','paused']);
const clean=v=>String(v||'').trim();
const error=(code,message,status=400)=>Object.assign(new Error(message),{code,status});

export function makeRunIdempotencyKey({projectId,prompt,idempotencyKey}={}){
  if(clean(idempotencyKey))return clean(idempotencyKey);
  const day=new Date().toISOString().slice(0,10);
  return `short:${projectId}:${createHash('sha256').update(`${clean(prompt)||'Create a unique 60-second YouTube Short'}:${day}`).digest('hex').slice(0,32)}`;
}

export async function startDirectShort({userId,projectId,prompt,idempotencyKey,source='api'}){
  if(!userId)throw error('AUTH_REQUIRED','Authentication is required',401);
  if(!projectId)throw error('PROJECT_NOT_FOUND','project_id is required',400);
  const project=await projects.get(projectId,userId);
  if(!project)throw error('PROJECT_NOT_FOUND','Project not found',404);
  const channel=await channels.getForUser(project.channel_id,userId);
  if(!channel)throw error('CHANNEL_NOT_CONNECTED','Project YouTube channel is not connected',409);
  if(channel.status!=='active')throw error('CHANNEL_NOT_CONNECTED','Project YouTube channel is not active',409);
  try{await loadYouTubeCredential(channel.id,userId)}catch(e){
    if(e.code==='YOUTUBE_REAUTH_REQUIRED')throw error('YOUTUBE_AUTH_EXPIRED',e.message,401);
    if(e.code==='YOUTUBE_AUTH'||e.code==='NOT_FOUND')throw error('CHANNEL_NOT_CONNECTED',e.message,409);
    throw error('TOKEN_REFRESH_FAILED','YouTube authorization could not be verified',401);
  }
  const key=makeRunIdempotencyKey({projectId,prompt,idempotencyKey});
  const existing=await jobs.findByIdempotency(key,userId);
  if(existing)return {job:existing,pipeline_run_id:existing.input?.pipeline_run_id||null,project_id:project.id,reused:true};
  const active=(await jobs.list(userId,{projectId,limit:20})).find(j=>ACTIVE.has(j.status)&&j.job_type==='pipeline');
  if(active)throw error('PIPELINE_ALREADY_RUNNING','A pipeline run is already active for this project',409);
  const run=await pipeline.createRun({userId,projectId,state:{request:{prompt:clean(prompt)||'Create a unique 60-second YouTube Short',source}}});
  try{
    const job=await enqueue({tenant_id:project.tenant_id,user_id:userId,channel_id:channel.id,project_id:project.id,job_type:'pipeline',current_step:'research',input:{project_id:project.id,pipeline_run_id:run.id,prompt:clean(prompt)||'Create a unique 60-second YouTube Short',config:project.config||{},source},priority:4,max_retries:3,idempotency_key:key});
    if(!job)throw error('PIPELINE_ENQUEUE_FAILED','Pipeline job could not be queued',500);
    await projects.update({userId,id:project.id,status:'running',config:project.config});
    if(job.input?.pipeline_run_id!==run.id)await pipeline.updateRun(run.id,{status:'failed',current_step:'research',state:{error:'Idempotency request reused'}}).catch(()=>{});
    return {job,pipeline_run_id:job.input?.pipeline_run_id||run.id,project_id:project.id,reused:job.input?.pipeline_run_id!==run.id};
  }catch(e){
    const raced=await jobs.findByIdempotency(key,userId).catch(()=>null);
    if(raced){await pipeline.updateRun(run.id,{status:'failed',state:{error:'Idempotency race; existing job retained'}}).catch(()=>{});return {job:raced,pipeline_run_id:raced.input?.pipeline_run_id||null,project_id:project.id,reused:true};}
    await pipeline.updateRun(run.id,{status:'failed',current_step:'research',state:{error:e.message}}).catch(()=>{});
    throw e;
  }
}

export async function getDirectRun({userId,runId,projectId}){
  if(!userId||!runId||!projectId)throw error('PROJECT_NOT_FOUND','Pipeline run not found',404);
  const run=await pipeline.get({userId,id:runId});
  if(!run||String(run.project_id)!==String(projectId))throw error('PROJECT_NOT_FOUND','Pipeline run not found',404);
  return run;
}
