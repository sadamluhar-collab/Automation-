import {dependencies,downstream} from '../../pipeline/pipeline.dependencies.js';
import {pipeline} from '../../database/repositories/pipeline.repository.js';

const send=(res,status,data)=>{res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(data))};

export async function list(req,res){
  try{
    const data=await pipeline.list({userId:req.user.id,projectId:req.query?.project_id,status:req.query?.status});
    send(res,200,{success:true,data});
  }catch(error){
    console.error('pipeline.list failed',error);
    send(res,500,{success:false,error:{code:'DATABASE',message:'Pipeline runs could not be loaded'}});
  }
}

export async function get(req,res){
  try{
    const data=await pipeline.get({userId:req.user.id,id:req.params.id});
    if(!data)return send(res,404,{success:false,error:{code:'NOT_FOUND',message:'Pipeline run not found'}});
    send(res,200,{success:true,data});
  }catch(error){
    console.error('pipeline.get failed',error);
    send(res,500,{success:false,error:{code:'DATABASE',message:'Pipeline run could not be loaded'}});
  }
}

export function inspect(req,res){
  const step=req.params.step;
  send(res,200,{success:true,...pipeline.inspectStep(step),dependencies:dependencies(step),downstream:downstream(step)});
}
