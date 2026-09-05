import {env} from '../../config/env.js';
import {loadYouTubeCredential} from '../../auth/youtube-credential.service.js';
import {readFile} from 'node:fs/promises';
import {downloadBytes} from '../../storage/storage.service.js';

async function upload(token,file,metadata){
  const init=await fetch('https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Type':'video/mp4','X-Upload-Content-Length':String(file.length)},body:JSON.stringify(metadata)});
  if(!init.ok)throw Object.assign(new Error(`YouTube upload init failed HTTP ${init.status}`),{status:init.status,code:'YOUTUBE_UPLOAD'});
  const location=init.headers.get('location');if(!location)throw new Error('YouTube upload session missing');
  const sent=await fetch(location,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'video/mp4','Content-Length':String(file.length)},body:file});
  const data=await sent.json().catch(()=>({}));
  if(!sent.ok)throw Object.assign(new Error(data?.error?.message||`YouTube upload failed HTTP ${sent.status}`),{status:sent.status,code:sent.status===429?'RATE_LIMIT':'YOUTUBE_UPLOAD'});
  return data;
}
export function createYouTubeRuntimeProvider(){return {async upload(input={}){
  const channelId=input.channel_id||input.channelId,userId=input.user_id||input.userId;
  if(!channelId||!userId)throw Object.assign(new Error('YouTube channel and user are required'),{code:'CHANNEL_REQUIRED'});
  const {accessToken}=await loadYouTubeCredential(channelId,userId);
  const artifact=input.artifact||input.assembly||{};let bytes;
  if(artifact.bucket&&artifact.path)bytes=await downloadBytes(artifact.bucket,artifact.path);
  else if(artifact.path)bytes=await readFile(artifact.path);
  else throw Object.assign(new Error('Final video artifact is missing'),{code:'UPLOAD_INPUT_MISSING'});
  const title=String(input.title||input.metadata?.snippet?.title||'').trim();
  if(!title)throw Object.assign(new Error('Short title is required'),{code:'METADATA_MISSING'});
  const description=String(input.description||input.metadata?.snippet?.description||'').trim();
  const publishAt=input.publish_at||input.publishAt||null;
  const status=publishAt?{privacyStatus:'private',publishAt}:{privacyStatus:String(input.privacy_status||'private')};
  return upload(accessToken,bytes,{snippet:{title,description,tags:Array.isArray(input.keywords)?input.keywords.slice(0,500):[],categoryId:String(input.category_id||22)},status});
}}}
