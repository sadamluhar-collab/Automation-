import {verifyAccessToken} from '../../auth/auth.service.js';

const send=(res,status,data)=>{res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(data))};

export async function auth(req,res,next){
  try{
    const h=req.headers.authorization||'';
    req.user=await verifyAccessToken(h.startsWith('Bearer ')?h.slice(7):null);
    next();
  }catch(e){
    send(res,401,{success:false,error:{code:'UNAUTHENTICATED',message:'Authentication required'}});
  }
}

export function workerAuth(req,res,next){
  const expected=process.env.WORKER_SECRET;
  if(!expected||req.headers['x-worker-secret']!==expected)return send(res,401,{success:false,error:{code:'WORKER_UNAUTHORIZED',message:'Worker authentication failed'}});
  next();
}
