const base=process.env.APP_BASE_URL||'http://localhost:10000';const r=await fetch(`${base}/health`);if(!r.ok)throw new Error(`Health failed ${r.status}`);console.log(await r.text());
