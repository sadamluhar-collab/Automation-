import {env} from '../../config/env.js';
import {loadYouTubeCredential} from '../../auth/youtube-credential.service.js';
import {readFile} from 'node:fs/promises';
import {downloadBytes} from '../../storage/storage.service.js';
import {youtubeUploads} from '../../database/repositories/youtube-upload.repository.js';

const timeoutFetch=async(url,options={},ms=120000)=>{const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{return await fetch(url,{...options,signal:c.signal})}catch(e){if(e?.name==='AbortError')throw Object.assign(new Error('YouTube upload request timed out'),{code:'TIMEOUT',retryable:false});throw e}finally{clearTimeout(t)}};
const uploadError=(message,status,code='YOUTUBE_UPLOAD',retryable=false)=>Object.assign(new Error(message),{status,code,retryable});
const parseRange=r=>{const m=String(r||'').match(/bytes=0-(\d+)/i);return m?Number(m[1])+1:0};

async function initSession(token,metadata,total){
  const r=await timeoutFetch('https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Type':'video/mp4','X-Upload-Content-Length':String(total)},body:JSON.stringify(metadata)});
  if(!r.ok){const d=await r.json().catch(()=>({}));throw uploadError(d?.error?.message||`YouTube upload init failed HTTP ${r.status}`,r.status,r.status===429?'RATE_LIMIT':'YOUTUBE_UPLOAD',r.status>=500||r.status===429)}
  const location=r.headers.get('location');if(!location)throw uploadError('YouTube upload session missing',502,'YOUTUBE_UPLOAD',true);return location;
}

async function probeSession(token,session,total){
  const r=await timeoutFetch(session,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Length':'0','Content-Range':`bytes */${total}`},body:Buffer.alloc(0)},30000);
  if(r.status===308)return {offset:parseRange(r.headers.get('range')),done:false};
  if(r.status===200||r.status===201)return {offset:total,done:true,data:await r.json().catch(()=>({}))};
  if(r.status===404)return {missing:true};
  const d=await r.json().catch(()=>({}));throw uploadError(d?.error?.message||`YouTube upload probe failed HTTP ${r.status}`,r.status,'UPLOAD_VERIFICATION_FAILED',false);
}

async function sendRemaining(token,session,file,offset){
  const end=file.length-1;
  const r=await timeoutFetch(session,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'video/mp4','Content-Length':String(Math.max(0,file.length-offset)),'Content-Range':`bytes ${offset}-${end}/${file.length}`},body:file.subarray(offset)});
  const data=await r.json().catch(()=>({}));
  if(r.status===308)return {offset:parseRange(r.headers.get('range')),done:false};
  if(r.status===200||r.status===201)return {offset:file.length,done:true,data};
  throw uploadError(data?.error?.message||`YouTube upload failed HTTP ${r.status}`,r.status,r.status===429?'RATE_LIMIT':'YOUTUBE_UPLOAD',r.status>=500||r.status===429);
}

export function createYouTubeRuntimeProvider(){return {async upload(input={}){
  const channelId=input.channel_id||input.channelId,userId=input.user_id||input.userId,runId=input.pipeline_run_id||input.pipelineRunId;
  if(!channelId||!userId)throw Object.assign(new Error('YouTube channel and user are required'),{code:'CHANNEL_REQUIRED'});
  if(!runId)throw Object.assign(new Error('Pipeline run is required for upload idempotency'),{code:'UPLOAD_IDEMPOTENCY_KEY_MISSING'});
  const {accessToken}=await loadYouTubeCredential(channelId,userId);
  const artifact=input.artifact||input.assembly||{};let bytes;
  if(artifact.bucket&&artifact.path)bytes=await downloadBytes(artifact.bucket,artifact.path);else if(artifact.path)bytes=await readFile(artifact.path);else throw Object.assign(new Error('Final video artifact is missing'),{code:'UPLOAD_INPUT_MISSING'});
  const title=String(input.title||input.metadata?.snippet?.title||'').trim();if(!title)throw Object.assign(new Error('Short title is required'),{code:'METADATA_MISSING'});
  const description=String(input.description||input.metadata?.snippet?.description||'').trim();
  const publishAt=input.publish_at||input.publishAt||null;const status=publishAt?{privacyStatus:'private',publishAt}:{privacyStatus:String(input.privacy_status||'private')};
  const metadata={snippet:{title,description,tags:Array.isArray(input.keywords)?input.keywords.slice(0,500):[],categoryId:String(input.category_id||22)},status};
  let record=await youtubeUploads.getByRun(runId);
  if(record?.status==='completed'&&record.youtube_video_id)return {id:record.youtube_video_id,already_exists:true};
  if(!record)record=await youtubeUploads.create({pipeline_run_id:runId,project_id:input.project_id||input.projectId,channel_id:channelId,user_id:userId,status:'pending',bytes_total:bytes.length,artifact_checksum:artifact.checksum||null,started_at:new Date().toISOString()});
  if(!record)throw Object.assign(new Error('Upload state could not be persisted'),{code:'UPLOAD_STATE_PERSIST_FAILED'});
  await youtubeUploads.update(record.id,{status:'uploading',bytes_total:bytes.length,artifact_checksum:artifact.checksum||record.artifact_checksum,started_at:record.started_at||new Date().toISOString()});
  let session=record.session_url,offset=Number(record.bytes_uploaded||0),probe=null;
  if(session){probe=await probeSession(accessToken,session,bytes.length);if(probe.missing){throw Object.assign(new Error('Existing YouTube upload session is no longer verifiable; refusing blind re-upload'),{code:'UPLOAD_VERIFICATION_FAILED'})}offset=probe.offset||0;if(probe.done){const id=probe.data?.id;if(!id)throw Object.assign(new Error('YouTube completed upload could not be verified'),{code:'UPLOAD_VERIFICATION_FAILED'});await youtubeUploads.update(record.id,{status:'completed',youtube_video_id:id,bytes_uploaded:bytes.length,completed_at:new Date().toISOString()});return {id,already_exists:true}}}
  else {session=await initSession(accessToken,metadata,bytes.length);await youtubeUploads.update(record.id,{session_url:session});}
  let result=await sendRemaining(accessToken,session,bytes,offset);
  while(!result.done){await youtubeUploads.update(record.id,{bytes_uploaded:result.offset||offset});offset=result.offset;result=await sendRemaining(accessToken,session,bytes,offset)}
  const id=result.data?.id;if(!id)throw Object.assign(new Error('YouTube upload completed without a video id'),{code:'UPLOAD_VERIFICATION_FAILED'});
  await youtubeUploads.update(record.id,{status:'completed',youtube_video_id:id,bytes_uploaded:bytes.length,completed_at:new Date().toISOString(),error_code:null,error_message:null});
  return {id,already_exists:false};
}}}
