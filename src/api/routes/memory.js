import {memory} from '../../database/repositories/memory.repository.js';
const send=(res,status,data)=>{res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(data))};
const fail=(res,error)=>send(res,400,{success:false,error:{code:'MEMORY_ERROR',message:error.message||'Memory operation failed'}});
export async function list(req,res){try{send(res,200,{success:true,data:await memory.list({userId:req.user.id})})}catch(error){console.error('memory.list failed',error);fail(res,error)}}
export async function get(req,res){try{const data=await memory.get({userId:req.user.id,channelId:req.params.id});if(!data)return send(res,404,{success:false,error:{code:'NOT_FOUND',message:'Channel memory not found'}});send(res,200,{success:true,data})}catch(error){console.error('memory.get failed',error);fail(res,error)}}
export async function save(req,res){try{send(res,200,{success:true,data:await memory.save({userId:req.user.id,channelId:req.params.id,data:req.body?.data})})}catch(error){console.error('memory.save failed',error);fail(res,error)}}
export async function restore(req,res){try{send(res,200,{success:true,data:await memory.restore({userId:req.user.id,channelId:req.params.id,version:req.body?.version})})}catch(error){console.error('memory.restore failed',error);fail(res,error)}}
