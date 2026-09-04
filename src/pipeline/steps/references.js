export async function run(ctx){return ctx.providers.llm.generate({task:'references',input:ctx.input,memory:ctx.memory})}
