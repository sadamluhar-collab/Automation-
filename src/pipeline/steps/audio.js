export async function run(ctx){if(!ctx.providers?.audio)throw new Error('Audio provider not configured');return ctx.providers.audio.generate(ctx.input)}
