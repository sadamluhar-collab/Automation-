import {authorizationUrl,exchangeCode,createState,verifyState} from '../../auth/youtube.oauth.js';
import {syncChannel} from '../../providers/youtube/youtube.sync.js';
import {channels} from '../../database/repositories/channel.repository.js';
import {encrypt} from '../../security/encryption.js';
import {env} from '../../config/env.js';

const send=(res,status,data)=>{res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(data))};
const redirect=(res,url)=>{res.statusCode=302;res.setHeader('location',url);res.setHeader('cache-control','no-store');res.end()};
const appUrl=()=>env().APP_BASE_URL.replace(/\/$/,'');

export function connect(req,res){
  try{
    const state=createState(req.user.id);
    send(res,200,{success:true,authorization_url:authorizationUrl(state)});
  }catch(e){
    send(res,500,{success:false,error:{code:'YOUTUBE_OAUTH_CONFIG',message:e.message||'YouTube OAuth configuration failed'}});
  }
}

export async function callback(req,res){
  try{
    if(req.query.error)throw new Error(req.query.error_description||`YouTube OAuth denied: ${req.query.error}`);
    const state=verifyState(req.query.state);
    const token=await exchangeCode(req.query.code);
    const data=await syncChannel(token.access_token);
    const item=data?.items?.[0];
    if(!item?.id)throw new Error('No YouTube channel was returned for this Google account');
    const snippet=item.snippet||{};
    const statistics=item.statistics||{};
    const branding=item.brandingSettings||{};
    const saved=await channels.upsert({
      userId:state.sub,
      email:'',
      channel:{
        youtube_channel_id:item.id,
        youtube_handle:snippet.customUrl||null,
        name:snippet.title||null,
        description:snippet.description||null,
        profile_image:snippet.thumbnails?.high?.url||snippet.thumbnails?.default?.url||null,
        banner:branding.image?.bannerExternalUrl||null,
        subscribers:Number(statistics.subscriberCount||0),
        total_views:Number(statistics.viewCount||0),
        video_count:Number(statistics.videoCount||0),
        country:snippet.country||null
      },
      credential:{
        access_token:encrypt(token.access_token),
        ...(token.refresh_token?{refresh_token:encrypt(token.refresh_token)}:{}),
        expires_at:new Date(Date.now()+Number(token.expires_in||3600)*1000).toISOString(),
        scope:token.scope||null
      }
    });
    redirect(res,`${appUrl()}/?youtube=connected&channel=${encodeURIComponent(saved.id)}`);
  }catch(e){
    console.error('YouTube OAuth callback failed',e);
    redirect(res,`${appUrl()}/?youtube=error&message=${encodeURIComponent(e.message||'YouTube connection failed')}`);
  }
}

export async function sync(req,res){
  try{
    const data=await syncChannel(req.body.access_token);
    send(res,200,{success:true,data});
  }catch(e){
    send(res,400,{success:false,error:{code:'YOUTUBE_SYNC',message:e.message}});
  }
}
