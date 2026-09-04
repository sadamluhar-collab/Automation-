export function backoff(attempt,base=5,max=900){ return Math.min(max,base*Math.pow(2,Math.max(0,attempt-1)) + Math.floor(Math.random()*1000)/1000); }
export async function withRetry(fn,{attempts=3,base=5}={}){let last;for(let i=1;i<=attempts;i++){try{return await fn(i)}catch(e){last=e;if(i<attempts)await new Promise(r=>setTimeout(r,backoff(i,base)*1000))}}throw last;}
