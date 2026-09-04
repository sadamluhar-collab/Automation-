export async function run(ctx){if(!ctx.providers?.llm)throw new Error('LLM provider not configured');return ctx.providers.llm.generate({task:'content-plan',input:ctx.input})}
