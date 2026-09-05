import {query} from '../../database/supabase.js';

export async function health(_req,res){
  const started=Date.now();let database='ok',status='ok',error=null;
  try{await query('users',{params:'?select=id&limit=1'});}catch(e){database='error';status='degraded';error=e.code==='CONFIGURATION'?'Database service-role configuration missing':'Database unavailable'}
  const body={success:status==='ok',status,latency_ms:Date.now()-started,services:{api:'ok',database,queue:'postgres',worker:'disposable',realtime:'supabase',scheduler:'postgres'},youtube_oauth_configured:Boolean(process.env.YOUTUBE_CLIENT_ID&&process.env.YOUTUBE_CLIENT_SECRET&&process.env.YOUTUBE_REDIRECT_URI&&process.env.WORKER_SECRET)};
  if(error)body.error={code:'HEALTH_DATABASE',message:error};
  res.statusCode=status==='ok'?200:503;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(body));
}
