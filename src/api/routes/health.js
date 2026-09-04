export function health(_req,res){
  const configured=Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY);
  const body=JSON.stringify({success:true,status:'ok',services:{api:'ok',database:configured?'configured':'unconfigured',queue:'postgres',worker:'disposable',realtime:'supabase',scheduler:'postgres'}});
  res.statusCode=200;
  res.setHeader('content-type','application/json; charset=utf-8');
  res.setHeader('cache-control','no-store');
  res.end(body);
}
