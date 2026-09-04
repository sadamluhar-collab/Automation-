const base=process.env.APP_BASE_URL||'http://localhost:10000';const r=await fetch(`${base}/health`);process.exit(r.ok?0:1);
