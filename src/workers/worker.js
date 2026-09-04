import {randomUUID} from 'node:crypto';
import {claimJob} from '../queue/queue.claim.js';
import {updateJob} from '../queue/queue.service.js';
import {executeStep} from '../pipeline/pipeline.engine.js';
import {pipeline} from '../database/repositories/pipeline.repository.js';
import {logger} from '../utils/logger.js';
import {registerWorker,heartbeat} from './worker-manager.js';
import {createRuntimeProviders,withRuntimeProviderKeys} from '../providers/runtime.js';

const id=`worker-${randomUUID()}`;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function executionInput(job,state){
  return {...(job.input||{}),pipeline_state:state,previous_result:state?.[job.current_step]?.result||null};
}

async function runPipelineJob(job){
  let runId=job.input?.pipeline_run_id;
  if(!runId){
    const run=await pipeline.createRun({userId:job.user_id,projectId:job.project_id,state:{}});
    runId=run.id;
    await updateJob(job.id,{input:{...(job.input||{}),pipeline_run_id:runId}});
  }
  const run=await pipeline.get({userId:job.user_id,id:runId});
  if(!run)throw new Error('Pipeline run not found');
  const step=job.current_step||run.current_step||pipeline.steps[0];
  const stepRow=await pipeline.getStep({runId,step});
  if(!stepRow)throw new Error(`Pipeline step ${step} not found`);
  const state=run.state&&typeof run.state==='object'?{...run.state}:{};

  await pipeline.updateRun(runId,{status:'running',current_step:step,state,progress:Math.max(Number(run.progress)||0,0)});
  await pipeline.updateStep(stepRow.id,{status:'running',progress:0,started_at:new Date().toISOString(),error:null});

  const providers=createRuntimeProviders(withRuntimeProviderKeys(job.providers||{}));
  const input=executionInput(job,state);
  const result=await executeStep(step,{job,input,state,checkpoint:job.checkpoint||stepRow.checkpoint||{},providers});
  state[step]={status:'completed',result};

  const index=pipeline.steps.indexOf(step);const next=pipeline.steps[index+1];
  const progress=Math.round(((index+1)/pipeline.steps.length)*100);
  await pipeline.updateStep(stepRow.id,{status:'completed',progress:100,checkpoint:{status:'completed'},completed_at:new Date().toISOString(),error:null});

  if(next){
    await pipeline.updateRun(runId,{status:'running',current_step:next,progress,state});
    await updateJob(job.id,{status:'queued',current_step:next,progress_percent:progress,checkpoint:{pipeline_run_id:runId,completed_step:step},output:{state},lease_until:null,worker_id:null,started_at:null});
    return {status:'advanced',next};
  }

  await pipeline.updateRun(runId,{status:'completed',current_step:step,progress:100,state});
  await updateJob(job.id,{status:'completed',output:{state},completed_at:new Date().toISOString(),progress_percent:100,checkpoint:{pipeline_run_id:runId,completed_step:step}});
  return {status:'completed'};
}

async function loop(){
  const job=await claimJob(id);
  if(!job){await sleep(3000);return loop();}
  try{
    await updateJob(job.id,{status:'running',worker_id:id,started_at:new Date().toISOString()});
    await heartbeat(id);
    if(job.job_type==='pipeline')await runPipelineJob(job);
    else{
      const providers=createRuntimeProviders(withRuntimeProviderKeys(job.providers||{}));
      const state=job.output?.state||{};
      const result=await executeStep(job.current_step||'research',{job,input:executionInput(job,state),state,checkpoint:job.checkpoint||{},providers});
      await updateJob(job.id,{status:'completed',output:{result},completed_at:new Date().toISOString(),progress_percent:100});
    }
  }catch(e){
    logger.error('job failed',{job_id:job.id,error:e.message});
    const runId=job.input?.pipeline_run_id;
    if(job.job_type==='pipeline'&&runId){
      const step=job.current_step||'research';
      const stepRow=await pipeline.getStep({runId,step}).catch(()=>null);
      if(stepRow)await pipeline.updateStep(stepRow.id,{status:'failed',error:{code:e.code||'FAILED',message:e.message}}).catch(()=>{});
      await pipeline.updateRun(runId,{status:'failed',current_step:step,state:{...(job.output?.state||{}),[step]:{status:'failed',error:e.message}}}).catch(()=>{});
    }
    await updateJob(job.id,{status:'failed',error_code:e.code||'FAILED',error_message:e.message});
  }
  return loop();
}

registerWorker(id).then(loop).catch(e=>{logger.error('worker stopped',{error:e.message});process.exit(1)});
