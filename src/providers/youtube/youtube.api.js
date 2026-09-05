export async function youtubeRequest(accessToken,path,init={}){
  if(!accessToken)throw Object.assign(new Error('Missing YouTube access token'),{code:'AUTH',status:401});
  const r=await fetch(`https://www.googleapis.com/youtube/v3/${path}`,{...init,headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json',...(init.headers||{})}});
  const t=await r.text();let d;try{d=t?JSON.parse(t):{}}catch{d={raw:t}};
  if(!r.ok){const reason=d?.error?.errors?.[0]?.reason||d?.error?.status||d?.error_description;const message=d?.error?.message||d?.message||`YouTube API ${r.status}`;throw Object.assign(new Error(message),{code:r.status===401?'AUTH':'YOUTUBE',status:r.status,reason,details:d})}
  return d;
}
