function parsed(result){const raw=result?.choices?.[0]?.message?.content??result?.candidates?.[0]?.content?.parts?.[0]?.text??result;if(typeof raw!=='string')return result;const s=raw.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();try{return JSON.parse(s)}catch{return result}}
export async function run(ctx){
 if(!ctx.providers?.llm)throw Object.assign(new Error('LLM provider not configured'),{code:'CONFIGURATION'});
 const plan=ctx.state?.['content-plan']?.result||{};
 const duration=Number(ctx.input?.duration_seconds||60);
 const result=parsed(await ctx.providers.llm.generate({task:'script',requirements:{duration_seconds:duration,max_seconds:60,short_form:true,spoken_words:Math.round(duration*2.3),return_json:true},channel:ctx.input?.channel_analysis||null,plan,existing_content:ctx.input?.existing_content||[]}));
 const script=result?.script||result;
 if(typeof script==='object'&&!Array.isArray(script))return {...script,duration_seconds:duration};
 return {text:String(script||'').trim(),duration_seconds:duration};
}
