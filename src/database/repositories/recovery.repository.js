import {query} from '../supabase.js';
import {jobs} from './job.repository.js';
import {projects} from './project.repository.js';
import {recoverWorkers} from '../../workers/recovery.js';

const ownedFault=async(id,userId)=>{
  const rows=await query('faults',{params:`?id=eq.${encodeURIComponent(id)}&select=*`});
  const fault=rows[0];
  if(!fault)return null;
  if(fault.job_id&&await jobs.get(fault.job_id,userId))return fault;
  if(fault.project_id&&await projects.get(fault.project_id,userId))return fault;
  return null;
};

const createAttempt=(faultId,action,status,details={})=>query('recovery_attempts',{method:'POST',params:'?select=*',body:{fault_id:faultId,action,status,details},headers:{Prefer:'return=representation'}});

const patchFault=(id,patch)=>query('faults',{method:'PATCH',params:`?id=eq.${encodeURIComponent(id)}`,body:patch,headers:{Prefer:'return=representation'}});

const retryable=new Set(['NETWORK','PROVIDER','YOUTUBE','QUEUE','DATABASE','UNKNOWN']);

export const recovery={
  list:async(userId,{status,type,limit=100}={})=>{
    const [ownedJobs,ownedProjects]=await Promise.all([jobs.list(userId,{limit:200}),projects.list(userId)]);
    const jobIds=ownedJobs.map(x=>x.id),projectIds=ownedProjects.map(x=>x.id);
    if(!jobIds.length&&!projectIds.length)return [];
    const filters=[];
    if(status)filters.push(`status=eq.${encodeURIComponent(status)}`);
    if(type)filters.push(`type=eq.${encodeURIComponent(type)}`);
    const rows=await query('faults',{params:`?${filters.length?filters.join('&')+'&':''}select=*&order=created_at.desc&limit=${Math.min(Number(limit)||100,200)}`});
    return rows.filter(x=>(x.job_id&&jobIds.includes(x.job_id))||(x.project_id&&projectIds.includes(x.project_id))).map(x=>({...x,job:jobIds.includes(x.job_id)?ownedJobs.find(j=>j.id===x.job_id)||null:null,project:projectIds.includes(x.project_id)?ownedProjects.find(p=>p.id===x.project_id)||null:null}));
  },
  get:async(userId,id)=>{
    const fault=await ownedFault(id,userId);
    if(!fault)return null;
    const attempts=await query('recovery_attempts',{params:`?fault_id=eq.${encodeURIComponent(id)}&select=*&order=created_at.desc`});
    const job=fault.job_id?await jobs.get(fault.job_id,userId):null;
    const project=fault.project_id?await projects.get(fault.project_id,userId):null;
    return {...fault,job,project,attempts};
  },
  action:async(userId,id,action)=>{
    const fault=await ownedFault(id,userId);
    if(!fault)throw Object.assign(new Error('Fault not found'),{code:'NOT_FOUND'});
    if(fault.status==='resolved'&&action!=='reopen')throw Object.assign(new Error('Fault is already resolved'),{code:'ALREADY_RESOLVED'});
    let result={action,status:'failed',details:{}};
    try{
      if(action==='retry_job'){
        if(!fault.job_id)throw new Error('Fault has no linked job');
        const job=await jobs.get(fault.job_id,userId);
        if(!job)throw new Error('Linked job is not accessible');
        if(!['failed','retrying','queued'].includes(job.status))throw new Error(`Job status ${job.status} cannot be retried from recovery`);
        const updated=await jobs.update(job.id,userId,{status:'queued',next_attempt_at:new Date().toISOString(),worker_id:null,lease_until:null,error_code:null,error_message:null,started_at:null,completed_at:null});
        await patchFault(id,{status:'active',attempts:Number(fault.attempts||0)+1});
        result={action,status:'completed',details:{job_id:job.id,next_status:'queued',updated:Array.isArray(updated)&&updated[0]?updated[0]:updated}};
      }else if(action==='repair_workers'){
        const repaired=await recoverWorkers();
        await patchFault(id,{status:'active',attempts:Number(fault.attempts||0)+1});
        result={action,status:'completed',details:{repaired}};
      }else if(action==='auto_recover'){
        if(retryable.has(fault.type)&&fault.job_id){
          const job=await jobs.get(fault.job_id,userId);
          if(job&&['failed','retrying','queued'].includes(job.status)){
            const updated=await jobs.update(job.id,userId,{status:'queued',next_attempt_at:new Date().toISOString(),worker_id:null,lease_until:null,error_code:null,error_message:null,started_at:null,completed_at:null});
            await patchFault(id,{status:'active',attempts:Number(fault.attempts||0)+1});
            result={action,status:'completed',details:{strategy:'job_retry',job_id:job.id,updated:Array.isArray(updated)&&updated[0]?updated[0]:updated}};
          }else{
            const repaired=await recoverWorkers();
            result={action,status:'completed',details:{strategy:'worker_recovery',repaired}};
          }
        }else{
          const repaired=await recoverWorkers();
          result={action,status:'completed',details:{strategy:'worker_recovery',repaired}};
        }
      }else if(action==='resolve'){
        await patchFault(id,{status:'resolved',resolved_at:new Date().toISOString()});
        result={action,status:'completed',details:{resolved_at:new Date().toISOString()}};
      }else if(action==='reopen'){
        await patchFault(id,{status:'active',resolved_at:null});
        result={action,status:'completed',details:{status:'active'}};
      }else throw Object.assign(new Error('Unsupported recovery action'),{code:'INVALID_ACTION'});
    }catch(error){
      result={action,status:'failed',details:{message:error.message,code:error.code||'RECOVERY_ERROR'}};
    }
    await createAttempt(id,action,result.status,result.details);
    return {...result,fault:await recovery.get(userId,id)};
  },
  recommendation:fault=>{
    if(['NETWORK','PROVIDER','YOUTUBE','QUEUE','DATABASE'].includes(fault?.type))return fault?.job_id?'retry_job':'repair_workers';
    if(fault?.type==='WORKER')return 'repair_workers';
    return 'auto_recover';
  }
};
