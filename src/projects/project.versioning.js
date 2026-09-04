export function nextVersion(rows=[]){return Math.max(0,...rows.map(x=>Number(x.version)||0))+1}
