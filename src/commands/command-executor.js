import {validateCommand} from './command-validator.js';
import {jobs} from '../database/repositories/job.repository.js';

const now=()=>new Date().toISOString();

export async function executeCommand(command,jobId,userId){
  validateCommand(command);
  if(!jobId)throw Object.assign(new Error('job_id is required'),{status:400,code:'JOB_REQUIRED'});
  const job=await jobs.get(jobId,userId);
  if(!job)throw Object.assign(new Error('Job not found'),{status:404,code:'JOB_NOT_FOUND'});

  const patch={updated_at:now()};
  if(command==='START'){
    if(!['queued','paused','failed','cancelled','stopped'].includes(job.status))throw Object.assign(new Error(`Cannot start a ${job.status} job`),{status:409,code:'INVALID_STATE'});
    patch.status='queued';patch.next_attempt_at=now();patch.error_code=null;patch.error_message=null;
  }else if(command==='PAUSE'){
    if(!['queued','running'].includes(job.status))throw Object.assign(new Error(`Cannot pause a ${job.status} job`),{status:409,code:'INVALID_STATE'});
    patch.status='paused';
  }else if(command==='STOP'){
    if(['completed','cancelled','stopped','skipped'].includes(job.status))throw Object.assign(new Error(`Cannot stop a ${job.status} job`),{status:409,code:'INVALID_STATE'});
    patch.status='stopped';patch.lease_until=null;
  }else if(command==='RESUME'){
    if(job.status!=='paused')throw Object.assign(new Error(`Cannot resume a ${job.status} job`),{status:409,code:'INVALID_STATE'});
    patch.status='queued';patch.next_attempt_at=now();
  }else if(command==='RETRY'){
    if(!['failed','stopped','cancelled'].includes(job.status))throw Object.assign(new Error(`Cannot retry a ${job.status} job`),{status:409,code:'INVALID_STATE'});
    if(Number(job.retry_count||0)>=Number(job.max_retries||3))throw Object.assign(new Error('Maximum retries reached'),{status:409,code:'MAX_RETRIES'});
    patch.status='queued';patch.retry_count=Number(job.retry_count||0)+1;patch.next_attempt_at=now();patch.error_code=null;patch.error_message=null;patch.lease_until=null;
  }else if(command==='RESTART'){
    if(['running','queued','paused'].includes(job.status))throw Object.assign(new Error(`Cannot restart a ${job.status} job`),{status:409,code:'INVALID_STATE'});
    patch.status='queued';patch.retry_count=0;patch.progress_percent=0;patch.completed_items=0;patch.failed_items=0;patch.current_item=null;patch.current_step=job.current_step||null;patch.next_attempt_at=now();patch.error_code=null;patch.error_message=null;patch.lease_until=null;patch.started_at=null;patch.completed_at=null;
  }else if(command==='SKIP'){
    if(['completed','cancelled','skipped'].includes(job.status))throw Object.assign(new Error(`Cannot skip a ${job.status} job`),{status:409,code:'INVALID_STATE'});
    patch.status='skipped';patch.completed_at=now();patch.lease_until=null;
  }else if(command==='CANCEL'){
    if(['completed','cancelled','skipped'].includes(job.status))throw Object.assign(new Error(`Cannot cancel a ${job.status} job`),{status:409,code:'INVALID_STATE'});
    patch.status='cancelled';patch.lease_until=null;
  }else if(['REGENERATE','START_NEXT_VIDEO','RESEARCH_AGAIN','RETRY_FAILED_CLIPS','REGENERATE_SCENE','STOP_AFTER_QC','RESYNC_YOUTUBE'].includes(command)){
    if(['completed','failed','stopped','cancelled','skipped'].includes(job.status)===false)throw Object.assign(new Error(`Cannot execute ${command} while job is ${job.status}`),{status:409,code:'INVALID_STATE'});
    patch.status='queued';patch.next_attempt_at=now();patch.error_code=null;patch.error_message=null;patch.lease_until=null;
    patch.input={...(job.input||{}),command:{name:command,requested_at:now()}};
  }
  await jobs.update(jobId,userId,patch);
  return jobs.get(jobId,userId);
}
