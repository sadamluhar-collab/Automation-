function jsonFromResult(result){
  const content=result?.choices?.[0]?.message?.content;
  if(typeof content!=='string')return null;
  const cleaned=content.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
  try{return JSON.parse(cleaned)}catch{return null}
}

function sceneInputs(ctx){
  const scenesResult=ctx.state?.scenes?.result;
  const parsed=jsonFromResult(scenesResult);
  const scenes=Array.isArray(parsed?.scenes)?parsed.scenes:[];
  if(scenes.length)return scenes.map(scene=>({
    prompt:String(scene.description||scene.visual_details?.description||'').trim(),
    scene_number:scene.scene_number,
    duration:Math.max(1,Number(scene.time_end||0)-Number(scene.time_start||0))||5,
    audio_elements:scene.audio_elements||null
  })).filter(x=>x.prompt);

  const scriptParsed=jsonFromResult(ctx.state?.script?.result);
  const sequence=Array.isArray(scriptParsed?.script?.visual_sequence)?scriptParsed.script.visual_sequence:[];
  return sequence.map((scene,index)=>({
    prompt:String(scene.description||'').trim(),
    scene_number:index+1,
    duration:5
  })).filter(x=>x.prompt);
}

export async function run(ctx){
  if(!ctx.providers?.video)throw new Error('Video provider not configured');
  const configured=Array.isArray(ctx.input?.clips)?ctx.input.clips:[];
  const clips=configured.length?configured:sceneInputs(ctx);
  if(!clips.length)throw Object.assign(new Error('No scene prompts available for clip generation'),{code:'CLIPS_INPUT_MISSING'});
  const out=[];
  for(let i=0;i<clips.length;i++){
    if(ctx.checkpoint?.clip_index>=i)continue;
    out.push(await ctx.providers.video.generate({...clips[i],duration:Number(clips[i].duration)||5,idempotencyKey:`${ctx.job.id}:clip:${i}`}));
    if(ctx.checkpoint)ctx.checkpoint.clip_index=i;
  }
  return out;
}
