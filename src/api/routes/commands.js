import {commandCenter} from '../../commands/command-center.js';
import {auditCommand} from '../../commands/command-audit.js';

const send=(res,status,data)=>{res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(data))};

export async function execute(req,res){
  try{
    const data=await commandCenter.execute(req.body?.command,req.body?.job_id,req.user.id);
    await auditCommand({user_id:req.user.id,job_id:req.body.job_id,command:req.body.command,new_state:data.status,request_id:req.requestId});
    return send(res,200,{success:true,data});
  }catch(e){
    console.error('command.execute failed',e);
    return send(res,e.status||400,{success:false,error:{code:e.code||'COMMAND_FAILED',message:e.message,request_id:req.requestId}});
  }
}
