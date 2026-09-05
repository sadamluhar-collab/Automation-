import {channels} from '../../database/repositories/channel.repository.js';
import {loadYouTubeCredential} from '../../auth/youtube-credential.service.js';
import {query} from '../../database/supabase.js';

const send=(res,status,data)=>{res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(data))};

async function healChannel(channel,userId){
  if(!channel?.id||!['pending','reauthorization_required'].includes(channel.status))return channel;
  try{
    await loadYouTubeCredential(channel.id,userId);
    const rows=await query('channels',{method:'PATCH',params:`?id=eq.${encodeURIComponent(channel.id)}&user_id=eq.${encodeURIComponent(userId)}&select=*`,headers:{Prefer:'return=representation'},body:{status:'active',last_error:null,updated_at:new Date().toISOString()}});
    return rows?.[0]||{...channel,status:'active',last_error:null};
  }catch(error){
    return {...channel,last_error:error.message||channel.last_error||null};
  }
}

export async function routes(req,res){
  try{
    const data=await channels.list(req.user.id);
    const healed=await Promise.all(data.map(channel=>healChannel(channel,req.user.id)));
    send(res,200,{success:true,data:healed});
  }catch(e){
    send(res,500,{success:false,error:{code:'DATABASE',message:e.message}});
  }
}
