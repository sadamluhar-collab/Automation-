export const now=()=>new Date().toISOString();
export const addSeconds=(date,seconds)=>new Date(new Date(date).getTime()+seconds*1000).toISOString();
