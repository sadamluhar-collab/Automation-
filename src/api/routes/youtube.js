import {authorizationUrl,exchangeCode,createState,verifyState} from '../../auth/youtube.oauth.js';
import {syncChannel,collectChannelSource} from '../../providers/youtube/youtube.sync.js';
import {channels} from '../../database/repositories/channel.repository.js';
import {protectYouTubeCredential} from '../../auth/token.service.js';
import {query} from '../../database/supabase.js';
import {env} from '../../config/env.js';

const send=(res,status,data)=>{res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(data))};
const redirect=(res,url)=>{res.statusCode=302;res.setHeader('location',url);res.setHeader('cache-control','no-store');res.end()};
const appUrl=()=>env().APP_BASE_URL.replace(/\/$/,'');
const errorCode=e=>e?.code==='YOUTUBE_REAUTH_REQUIRED'||e?.status===401?'YOUTUBE_REAUTH_REQUIRED':e?.code==='DUPLICATE_CHANNEL'?'DUPLICATE_CHANNEL':'YOUTUBE_CONNECT';

export function connect(req,res){
  try{send(res,200,{success:true,authorization_url:authorizationUrl(createState(req.user.id))})}
  catch(e){send(res,500,{success:false,error:{code:'YOUTUBE_OAUTH_CONFIG',message:e.message||'YouTube OAuth configuration failed'}})}
}

async function saveMemory(channelId,data){
  const existing=await query('channel_memory',{params:`?channel_id=eq.${encodeURIComponent(channelId)}&select=id,version`});
  const version=Number(existing?.[0]?.version||0)+1;
  const body={channel_id:channelId,data,version,updated_at:new Date().toISOString()};
  const rows=existing?.[0]
    ? await query('channel_memory',{method:'PATCH',params:`?channel_id=eq.${encodeURIComponent(channelId)}&select=*`,headers:{Prefer:'return=representation'},body})
    : await query('channel_memory',{method:'POST',params:'?select=*',headers:{Prefer:'return=representation'},body:{channel_id:channelId,data,version}});
  const memory=rows?.[0];if(!memory?.id)throw new Error('Channel memory could not be saved');
  await query('channel_memory_versions',{method:'POST',params:'?select=id',headers:{Prefer:'return=representation'},body:{channel_id:channelId,version,data,status:'active'}});
  return memory;
}

async function markChannel(id,status,lastError=null){
  await query('channels',{method:'PATCH',params:`?id=eq.${encodeURIComponent(id)}&select=id,status`,headers:{Prefer:'return=representation'},body:{status,last_error:lastError,analyzed_at:status==='active'?new Date().toISOString():undefined,updated_at:new Date().toISOString()}}).catch(()=>{});
}

export async function callback(req,res){
  let state;
  try{
    if(req.query.error)throw Object.assign(new Error(req.query.error_description||`YouTube OAuth denied: ${req.query.error}`),{code:'OAUTH_DENIED'});
    state=verifyState(req.query.state);
    const token=await exchangeCode(req.query.code);
    const data=await syncChannel(token.access_token);
    const item=data?.items?.[0];if(!item?.id)throw Object.assign(new Error('No YouTube channel was returned for this Google account'),{code:'NO_CHANNEL'});
    const s=item.snippet||{},stats=item.statistics||{},brand=item.brandingSettings||{};
    const saved=await channels.upsert({userId:state.sub,email:'',channel:{youtube_channel_id:item.id,youtube_handle:s.customUrl||null,name:s.title||null,description:s.description||null,profile_image:s.thumbnails?.high?.url||s.thumbnails?.default?.url||null,banner:brand.image?.bannerExternalUrl||null,subscribers:Number(stats.subscriberCount||0),total_views:Number(stats.viewCount||0),video_count:Number(stats.videoCount||0),country:s.country||null},credential:protectYouTubeCredential({access_token:token.access_token,refresh_token:token.refresh_token,expires_at:new Date(Date.now()+Number(token.expires_in||3600)*1000).toISOString(),scope:token.scope,token_type:token.token_type})});
    const source=await collectChannelSource(saved.id,state.sub);
    const memory=await saveMemory(saved.id,{status:'analyzed',analysis_status:'complete',source:'youtube_data_api',analyzed_at:new Date().toISOString(),channel:source.channel,summary:source.summary,videos:source.videos,content_rules:{avoid_repeating_titles:true,avoid_repeating_topics:true,prefer_recent_patterns:true}});
    await markChannel(saved.id,'active');
    redirect(res,`${appUrl()}/?youtube=connected&channel=${encodeURIComponent(saved.id)}`);
    return memory;
  }catch(e){
    console.error('YouTube OAuth callback failed',e);
    if(state?.sub){
      try{
        const found=await query('channels',{params:`?user_id=eq.${encodeURIComponent(state.sub)}&select=id&order=updated_at.desc&limit=1`});
        if(found?.[0]?.id)await markChannel(found[0].id,'error',e.message||'YouTube connection failed');
      }catch{}
    }
    redirect(res,`${appUrl()}/?youtube=error&code=${encodeURIComponent(errorCode(e))}&message=${encodeURIComponent(e.message||'YouTube connection failed')}`);
  }
}

export async function sync(req,res){
  try{
    const channelId=String(req.body?.channel_id||'').trim();
    if(!channelId)return send(res,400,{success:false,error:{code:'VALIDATION',message:'channel_id is required'}});
    const {data}=await (await import('../../providers/youtube/youtube.sync.js')).syncStoredChannel(channelId,req.user.id);
    const item=data?.items?.[0];if(!item?.id)throw new Error('YouTube channel not found');
    const snippet=item.snippet||{},stats=item.statistics||{},brand=item.brandingSettings||{};
    const saved=await channels.upsert({userId:req.user.id,channel:{youtube_channel_id:item.id,youtube_handle:snippet.customUrl||null,name:snippet.title||null,description:snippet.description||null,profile_image:snippet.thumbnails?.high?.url||snippet.thumbnails?.default?.url||null,banner:brand.image?.bannerExternalUrl||null,subscribers:Number(stats.subscriberCount||0),total_views:Number(stats.viewCount||0),video_count:Number(stats.videoCount||0),country:snippet.country||null},credential:null});
    const source=await collectChannelSource(saved.id,req.user.id);
    const memory=await saveMemory(saved.id,{status:'analyzed',analysis_status:'complete',source:'youtube_data_api',analyzed_at:new Date().toISOString(),channel:source.channel,summary:source.summary,videos:source.videos,content_rules:{avoid_repeating_titles:true,avoid_repeating_topics:true,prefer_recent_patterns:true}});
    await markChannel(saved.id,'active');
    send(res,200,{success:true,data:{channel:saved,memory}});
  }catch(e){
    const status=e.status||400;
    send(res,status,{success:false,error:{code:e.code||'YOUTUBE_SYNC',message:e.message||'YouTube sync failed'}});
  }
}
