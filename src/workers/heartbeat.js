export const heartbeatLoop=(fn,seconds=20)=>setInterval(()=>fn().catch(()=>{}),seconds*1000);
