import {query} from '../database/supabase.js';
import {enqueue} from '../queue/queue.service.js';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fields=(expr,min,max)=>String(expr||'*').split(',').flatMap(part=>{part=part.trim();let [base,stepText]=part.split('/');const step=Math.max(1,Number(stepText)||1);let lo=min,hi=max;if(base==='*'){}else if(base.includes('-')){[lo,hi]=base.split('-').map(Number)}else{lo=Number(base);hi=lo}if(!Number.isFinite(lo)||!Number.isFinite(hi))return[];const out=[];for(let n=lo;n<=hi;n+=step)if(n>=min&&n<=max)out.push(n);return out});
const cronMatch=(date,expr,timezone='UTC')=>{const p=String(expr||'').trim().split(/\s+/);if(p.length!==5)return false;const parts=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,minute:'2-digit',hour:'2-digit',day:'2-digit',month:'2-digit',weekday:'short',hourCycle:'h23'}).formatToParts(date);const get=t=>parts.find(x=>x.type===t)?.value;const minute=Number(get('minute')),hour=Number(get('hour')),day=Number(get('day')),month=Number(get('month')),wd=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(get('weekday'));return fields(p[0],0,59).includes(minute)&&fields(p[1],0,23).includes(hour)&&fields(p[2],1,31).includes(day)&&fields(p[3],1,12).includes(month)&&fields(p[4],0,6).includes(wd)};
export const nextCron=(from,expr,timezone='UTC')=>{const start=new Date(Math.floor(from.getTime()/60000)*60000+60000);for(let i=0;i<=366*24*60;i++){const d=new Date(start.getTime()+i*60000);if(cronMatch(d,expr,timezone))return d.toISOString()}throw new Error('Cron schedule has no matching time within one year')};

async function claimDue(){
  const now=new Date().toISOString();
  const rows=await query('schedules',{params:`?enabled=eq.true&next_run_at=lte.${encodeURIComponent(now)}&select=*&order=next_run_at.asc&limit=20`});
  for(const schedule of rows){
    let next=null;
    try{if(schedule.schedule_type==='cron')next=nextCron(new Date(now),schedule.cron_expression,schedule.timezone||'UTC')}catch(error){await query('schedules',{method:'PATCH',params:`?id=eq.${encodeURIComponent(schedule.id)}&select=id`,body:{enabled:false,status:'error',last_error:error.message,updated_at:now}}).catch(()=>{});continue}
    const claimed=await query('schedules',{method:'PATCH',params:`?id=eq.${encodeURIComponent(schedule.id)}&enabled=eq.true&next_run_at=lte.${encodeURIComponent(now)}&select=*`,headers:{Prefer:'return=representation'},body:{next_run_at:next,enabled:Boolean(next),status:next?'active':'completed',last_run_at:now,last_error:null,updated_at:now}});
    if(!claimed?.[0])continue;
    try{await enqueue({user_id:schedule.user_id,channel_id:schedule.channel_id,project_id:schedule.project_id,job_type:'pipeline',current_step:'research',input:{...(schedule.payload||{}),schedule_id:schedule.id,scheduled_for:schedule.next_run_at},priority:4,max_retries:3})}
    catch(error){const retry=new Date(Date.now()+60000).toISOString();await query('schedules',{method:'PATCH',params:`?id=eq.${encodeURIComponent(schedule.id)}&select=id`,body:{enabled:true,status:'error',next_run_at:retry,last_error:error.message,updated_at:new Date().toISOString()}}).catch(()=>{})}
  }
}

export async function tick(){return claimDue()}
export async function runScheduler(){for(;;){try{await claimDue()}catch(error){console.error('scheduler cycle failed',error)}await sleep(15000)}}
