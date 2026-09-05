export async function run(ctx){
 if(!ctx.providers?.llm)throw Object.assign(new Error('LLM provider not configured'),{code:'CONFIGURATION'});
 const plan=ctx.state?.['content-plan']?.result||{};const script=ctx.state?.script?.result||{};
 return ctx.providers.llm.generate({task:'scenes',requirements:{total_duration_seconds:60,vertical:'9:16',return_json:true},plan,script});
}
