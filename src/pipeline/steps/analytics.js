export async function run(ctx){if(!ctx.providers?.youtube)throw new Error('YouTube provider not configured');return ctx.providers.youtube.analytics(ctx.input)}
