const required = ['SUPABASE_URL'];
export function env() {
  const e = process.env;
  for (const k of required) if (!e[k]) throw new Error(`Missing environment variable: ${k}`);
  return { ...e, PORT: Number(e.PORT || 10000), APP_BASE_URL: e.APP_BASE_URL || `http://localhost:${e.PORT || 10000}` };
}
