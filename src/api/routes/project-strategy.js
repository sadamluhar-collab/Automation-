import {projects} from '../../database/repositories/project.repository.js';
import {analyzeProjectChannel,getProjectStrategy} from '../../projects/channel-strategy.service.js';

const send=(res,status,data)=>{res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(data))};

export async function get(req,res){
  try{
    const id=String(req.params.id||'').trim();
    const project=await projects.get(id,req.user.id);
    if(!project)return send(res,404,{success:false,error:{code:'NOT_FOUND',message:'Project not found'}});
    send(res,200,{success:true,data:await getProjectStrategy({userId:req.user.id,projectId:id})});
  }catch(error){console.error('project.strategy.get failed',error);send(res,500,{success:false,error:{code:'DATABASE',message:'Project strategy could not be loaded'}})}
}

export async function analyze(req,res){
  try{
    const id=String(req.params.id||'').trim();
    const project=await projects.get(id,req.user.id);
    if(!project)return send(res,404,{success:false,error:{code:'NOT_FOUND',message:'Project not found'}});
    const config={...project.config,...(req.body?.config||{})};
    const result=await analyzeProjectChannel({userId:req.user.id,project,config});
    send(res,200,{success:true,data:result});
  }catch(error){
    console.error('project.strategy.analyze failed',error);
    const status=['AUTH','CONFIGURATION'].includes(error.code)?400:500;
    send(res,status,{success:false,error:{code:error.code||'STRATEGY_FAILED',message:error.message||'Project strategy analysis failed'}});
  }
}
