import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';

const exec=promisify(execFile);

function urlsFrom(value,out=[]){
  if(!value)return out;
  if(typeof value==='string'&&/^https?:\/\//i.test(value))out.push(value);
  else if(Array.isArray(value))for(const item of value)urlsFrom(item,out);
  else if(typeof value==='object')for(const [key,item] of Object.entries(value)){
    if(['url','video_url','videoUrl','download_url','downloadUrl'].includes(key)&&typeof item==='string'&&/^https?:\/\//i.test(item))out.push(item);
    else if(typeof item==='object'||Array.isArray(item))urlsFrom(item,out);
  }
  return [...new Set(out)];
}

async function download(url,path){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),120000);
  try{
    const response=await fetch(url,{signal:controller.signal,redirect:'follow'});
    if(!response.ok)throw new Error(`Clip download failed HTTP ${response.status}`);
    const buffer=Buffer.from(await response.arrayBuffer());
    if(!buffer.length)throw new Error('Clip download returned an empty file');
    await writeFile(path,buffer);
  }catch(error){
    if(error?.name==='AbortError')throw new Error('Clip download timed out');
    throw error;
  }finally{clearTimeout(timer)}
}

async function hasAudio(ffmpeg,input){
  try{
    await exec(ffmpeg,['-hide_banner','-loglevel','error','-i',input,'-map','0:a:0','-f','null','-']);
    return true;
  }catch{return false}
}

async function normalize(ffmpeg,input,output,audio){
  const video=['-y','-hide_banner','-loglevel','error','-i',input];
  if(!audio)video.push('-f','lavfi','-i','anullsrc=channel_layout=stereo:sample_rate=48000');
  video.push('-map','0:v:0',audio?'-map':'-map','1:a:0');
  if(audio)video.splice(video.indexOf('1:a:0'),1,'-map','0:a:0');
  video.push('-vf','scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,format=yuv420p','-r','30','-c:v','libx264','-preset','veryfast','-crf','20','-c:a','aac','-ar','48000','-ac','2','-shortest',output);
  await exec(ffmpeg,video);
}

export async function run(ctx){
  const ffmpeg=ctx.ffmpeg||'ffmpeg';
  const configuredInput=ctx.input||{};
  const state=ctx.state||{};
  const clipResults=state.clips?.result;
  const clipUrls=urlsFrom(clipResults);
  const directFiles=Array.isArray(configuredInput.listFile)?configuredInput.listFile:[];
  if(!clipUrls.length&&!directFiles.length)throw Object.assign(new Error('Assembly requires generated video clips'),{code:'ASSEMBLY_INPUT_MISSING'});

  const root=await mkdtemp(join(tmpdir(),'automation-assembly-'));
  try{
    const sources=[];
    if(clipUrls.length){
      for(let i=0;i<clipUrls.length;i++){
        const raw=join(root,`source-${i}.mp4`);
        const normalized=join(root,`clip-${i}.mp4`);
        await download(clipUrls[i],raw);
        await normalize(ffmpeg,raw,normalized,await hasAudio(ffmpeg,raw));
        sources.push(normalized);
      }
    }else{
      for(const file of directFiles)sources.push(String(file));
    }
    const listFile=join(root,'clips.txt');
    await writeFile(listFile,sources.map(file=>`file '${file.replaceAll("'","'\\''")}'`).join('\n')+'\n','utf8');
    const output=String(configuredInput.output||join(tmpdir(),`automation-${ctx.job?.id||randomUUID()}.mp4`));
    await exec(ffmpeg,['-y','-hide_banner','-loglevel','error','-f','concat','-safe','0','-i',listFile,'-c','copy','-movflags','+faststart',output]);
    return {path:output,listFile,clipCount:sources.length,source:'generated-clips'};
  }finally{
    await rm(root,{recursive:true,force:true}).catch(()=>{});
  }
}
