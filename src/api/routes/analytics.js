import {analyticsRepository} from '../../analytics/analytics.repository.js';

const send=(res,status,data)=>{res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(data))};

export async function list(req,res){
  try{
    const q=req.query||{};
    const data=await analyticsRepository.summary({userId:req.user.id,channelId:q.channel_id||'',projectId:q.project_id||'',from:q.from||'',to:q.to||''});
    if(data===null)return send(res,404,{success:false,error:{code:'NOT_FOUND',message:'Channel not found'}});
    send(res,200,{success:true,data});
  }catch(error){
    console.error('analytics.list failed',error);
    send(res,500,{success:false,error:{code:'DATABASE',message:'Analytics could not be loaded'}});
  }
}

export async function channels(req,res){
  try{send(res,200,{success:true,data:await analyticsRepository.channels(req.user.id)})}
  catch(error){console.error('analytics.channels failed',error);send(res,500,{success:false,error:{code:'DATABASE',message:'Analytics channels could not be loaded'}})}
}
