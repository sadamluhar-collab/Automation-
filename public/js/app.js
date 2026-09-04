import {api} from './api.js';import {subscribeTables} from './realtime.js';
const health=document.querySelector('#health');const realtime=document.querySelector('#realtime');
api('/health').then(x=>{health.textContent=x.success?'SYSTEM HEALTHY':'DATA UNAVAILABLE'}).catch(()=>health.textContent='DATA UNAVAILABLE');
const tableModules={channels:['channels'],projects:['projects','project_versions'],pipeline:['pipeline_runs','pipeline_steps','scenes','scene_versions'],jobs:['automation_jobs','job_items'],recovery:['faults','recovery_attempts'],commands:['commands'],schedules:['schedules'],analytics:['analytics'],artifacts:['artifacts'],memory:['channel_memory','channel_memory_versions']};
const tables=[...new Set(Object.values(tableModules).flat())];
subscribeTables({tables,onStatus:status=>{realtime.textContent=`REALTIME ${status.toUpperCase()}`},onChange:change=>{window.dispatchEvent(new CustomEvent(`automation:${change.table}`,{detail:change}));}}).catch(err=>{realtime.textContent='REALTIME UNAVAILABLE';console.error(err)});
export {tableModules};
