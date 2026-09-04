export async function run(ctx){if(!ctx.providers?.llm)throw new Error('LLM provider not configured');return ctx.providers.llm.generate({task:'script',input:ctx.input,memory:ctx.memory})}
