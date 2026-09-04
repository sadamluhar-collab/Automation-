import {channels} from '../../database/repositories/channel.repository.js';

const send=(res,status,data)=>{res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(data))};

export async function routes(req,res){
  try{
    const data=await channels.list(req.user.id);
    send(res,200,{success:true,data});
  }catch(e){
    send(res,500,{success:false,error:{code:'DATABASE',message:e.message}});
  }
}
