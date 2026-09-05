import {query} from '../../database/supabase.js';
import {rpc} from '../../database/transactions.js';

const send=(res,status,data)=>{res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(data))};

export async function enqueue(req,res){
  try{
    const command=String(req.body?.command||'').trim();
    const args=req.body?.args&&typeof req.body.args==='object'?req.body.args:{};
    if(!command)return send(res,400,{success:false,error:{code:'BROWSER_COMMAND_REQUIRED',message:'command is required',request_id:req.requestId}});
    const rows=await query('browser_commands',{method:'POST',body:{user_id:req.user.id,command,args},headers:{Prefer:'return=representation'}});
    return send(res,202,{success:true,data:rows?.[0]||null});
  }catch(e){return send(res,400,{success:false,error:{code:'BROWSER_COMMAND_FAILED',message:e.message,request_id:req.requestId}})}
}

export async function status(req,res){
  try{
    const rows=await query('browser_commands',{params:`?id=eq.${encodeURIComponent(req.params.id)}&user_id=eq.${encodeURIComponent(req.user.id)}&limit=1`});
    if(!rows?.[0])return send(res,404,{success:false,error:{code:'BROWSER_COMMAND_NOT_FOUND',message:'Browser command not found',request_id:req.requestId}});
    return send(res,200,{success:true,data:rows[0]});
  }catch(e){return send(res,400,{success:false,error:{code:'BROWSER_COMMAND_STATUS_FAILED',message:e.message,request_id:req.requestId}})}
}

export async function claim(req,res){
  try{
    const rows=await rpc('claim_browser_command',{p_worker_id:String(req.body?.worker_id||'pc-browser')});
    return send(res,200,{success:true,data:rows?.[0]||null});
  }catch(e){return send(res,400,{success:false,error:{code:'BROWSER_COMMAND_CLAIM_FAILED',message:e.message,request_id:req.requestId}})}
}

export async function complete(req,res){
  try{
    const id=req.params.id;
    const status=req.body?.status==='failed'?'failed':'completed';
    const patch={status,result:req.body?.result??null,error_message:req.body?.error_message??null,completed_at:new Date().toISOString()};
    const rows=await query('browser_commands',{method:'PATCH',params:`?id=eq.${encodeURIComponent(id)}&status=eq.running`,body:patch,headers:{Prefer:'return=representation'}});
    if(!rows?.[0])return send(res,404,{success:false,error:{code:'BROWSER_COMMAND_NOT_RUNNING',message:'Command is not running',request_id:req.requestId}});
    return send(res,200,{success:true,data:rows[0]});
  }catch(e){return send(res,400,{success:false,error:{code:'BROWSER_COMMAND_COMPLETE_FAILED',message:e.message,request_id:req.requestId}})}
}
