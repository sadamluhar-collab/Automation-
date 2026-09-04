import {recovery} from '../../database/repositories/recovery.repository.js';

const send=(res,status,data)=>{res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(data))};

export async function list(req,res){
  try{
    const data=await recovery.list(req.user.id,{status:req.query?.status,type:req.query?.type,limit:req.query?.limit});
    send(res,200,{success:true,data});
  }catch(error){console.error('recovery.list failed',error);send(res,500,{success:false,error:{code:'DATABASE',message:'Recovery faults could not be loaded'}})}
}

export async function get(req,res){
  try{
    const data=await recovery.get(req.user.id,req.params.id);
    if(!data)return send(res,404,{success:false,error:{code:'NOT_FOUND',message:'Fault not found'}});
    send(res,200,{success:true,data,recommended_action:recovery.recommendation(data)});
  }catch(error){console.error('recovery.get failed',error);send(res,500,{success:false,error:{code:'DATABASE',message:'Recovery fault could not be loaded'}})}
}

export async function action(req,res){
  try{
    const actionName=req.body?.action;
    const allowed=['auto_recover','retry_job','repair_workers','resolve','reopen'];
    if(!allowed.includes(actionName))return send(res,400,{success:false,error:{code:'INVALID_ACTION',message:`Action must be one of: ${allowed.join(', ')}`}});
    const data=await recovery.action(req.user.id,req.params.id,actionName);
    send(res,data.status==='failed'?409:200,{success:data.status!=='failed',data});
  }catch(error){console.error('recovery.action failed',error);send(res,error.code==='NOT_FOUND'?404:409,{success:false,error:{code:error.code||'RECOVERY_ERROR',message:error.message||'Recovery action failed'}})}
}
