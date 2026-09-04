const UA='AutomationPlatform/1.0';

export async function internetResearch(query,{maxResults=8}={}){
  const q=String(query||'').trim();
  if(!q) throw Object.assign(new Error('Research query missing'),{code:'VALIDATION'});
  const url=`https://www.google.com/search?q=${encodeURIComponent(q)}&num=${Math.min(maxResults,10)}`;
  const r=await fetch(url,{headers:{'User-Agent':UA,'Accept':'text/html'}});
  if(!r.ok) throw Object.assign(new Error(`Internet search HTTP ${r.status}`),{code:'INTERNET_SEARCH'});
  const html=await r.text();
  const results=[];
  const re=/<a href="\/url\?q=(https?:\/\/[^&"]+)[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while((m=re.exec(html))&&results.length<maxResults){
    const link=decodeURIComponent(m[1]);
    const title=m[2].replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
    if(title&&/^https?:/.test(link)&&!link.includes('google.com/')) results.push({title,url:link,source:'internet'});
  }
  if(!results.length) throw Object.assign(new Error('Internet search returned no usable results'),{code:'INTERNET_EMPTY'});
  return {query:q,results};
}

export async function internetFetch(url,{maxBytes=500000}={}){
  const target=new URL(url);
  if(!['http:','https:'].includes(target.protocol)) throw Object.assign(new Error('Unsupported URL protocol'),{code:'VALIDATION'});
  const r=await fetch(target,{headers:{'User-Agent':UA,'Accept':'text/html,text/plain,application/xhtml+xml'}});
  if(!r.ok) throw Object.assign(new Error(`Internet fetch HTTP ${r.status}`),{code:'INTERNET_FETCH'});
  const text=(await r.text()).slice(0,maxBytes);
  return {url:target.toString(),text,source:'internet'};
}
