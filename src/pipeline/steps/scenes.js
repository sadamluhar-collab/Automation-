export async function run(ctx){return ctx.providers.llm.generate({task:'scenes',input:ctx.input,memory:ctx.memory})}
