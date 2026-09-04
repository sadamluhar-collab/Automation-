import {query} from '../supabase.js';
import {projects} from './project.repository.js';

const steps=['research','content-plan','script','scenes','references','clips','audio','music','assembly','thumbnail','qc','upload','analytics'];

const runSelect='*';

const userOwnsProject=async(projectId,userId)=>Boolean(await projects.get(projectId,userId));

const latestSceneVersions=async scenes=>{
  if(!scenes.length)return [];
  const out=[];
  for(const scene of scenes){
    const rows=await query('scene_versions',{params:`?scene_id=eq.${encodeURIComponent(scene.id)}&select=*&order=version.desc&limit=1`});
    out.push({...scene,latest_version:rows[0]||null});
  }
  return out;
};

export const pipeline={
  steps,
  list:async({userId,projectId,status}={})=>{
    let projectIds=null;
    if(projectId){
      if(!(await userOwnsProject(projectId,userId)))return [];
      projectIds=[projectId];
    }else{
      const owned=await projects.list(userId);
      projectIds=owned.map(x=>x.id);
      if(!projectIds.length)return [];
    }
    const filters=[];
    if(projectIds.length===1)filters.push(`project_id=eq.${encodeURIComponent(projectIds[0])}`);
    else filters.push(`project_id=in.(${projectIds.map(encodeURIComponent).join(',')})`);
    if(status)filters.push(`status=eq.${encodeURIComponent(status)}`);
    return query('pipeline_runs',{params:`?${filters.join('&')}&select=${runSelect}&order=created_at.desc&limit=100`});
  },
  get:async({userId,id})=>{
    const runs=await query('pipeline_runs',{params:`?id=eq.${encodeURIComponent(id)}&select=*`});
    const run=runs[0];
    if(!run)return null;
    if(!(await userOwnsProject(run.project_id,userId)))return null;
    const [stepRows,sceneRows]=await Promise.all([
      query('pipeline_steps',{params:`?pipeline_run_id=eq.${encodeURIComponent(id)}&select=*&order=created_at.asc`}).catch(async()=>query('pipeline_steps',{params:`?pipeline_run_id=eq.${encodeURIComponent(id)}&select=*&order=step.asc` })),
      query('scenes',{params:`?project_id=eq.${encodeURIComponent(run.project_id)}&select=*&order=scene_number.asc`})
    ]);
    return {...run,steps:stepRows,scenes:await latestSceneVersions(sceneRows)};
  },
  inspectStep:step=>({step,dependencies:stepDeps(step),downstream:downstream(step)})
};

const depMap={research:[], 'content-plan':['research'],script:['content-plan'],scenes:['script'],references:['scenes'],clips:['references'],audio:['script'],music:['audio'],assembly:['clips','audio','music'],thumbnail:['assembly'],qc:['assembly','thumbnail'],upload:['qc'],analytics:['upload']};
const stepDeps=step=>depMap[step]||[];
const downstream=step=>{
  const out=[];
  let changed=true;
  while(changed){
    changed=false;
    for(const [key,deps] of Object.entries(depMap)){
      if((deps.includes(step)||deps.some(dep=>out.includes(dep)))&&!out.includes(key)){out.push(key);changed=true}
    }
  }
  return out;
};
