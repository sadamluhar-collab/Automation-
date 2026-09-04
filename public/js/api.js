export async function api(path,init={}){const r=await fetch(path,{...init,headers:{'content-type':'application/json',...(init.headers||{})}});return r.json()}
