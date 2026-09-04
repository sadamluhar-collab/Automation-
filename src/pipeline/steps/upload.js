export async function run(ctx){if(!ctx.providers?.youtube)throw new Error('YouTube provider not configured');return ctx.providers.youtube.upload(ctx.input)}
