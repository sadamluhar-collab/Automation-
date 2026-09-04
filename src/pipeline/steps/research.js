export async function run(ctx){if(!ctx.providers?.research)throw new Error('Research provider not configured');return ctx.providers.research.research(ctx.input)}
