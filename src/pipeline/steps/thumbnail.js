export async function run(ctx){if(!ctx.providers?.image)throw new Error('Image provider not configured');return ctx.providers.image.generate(ctx.input)}
