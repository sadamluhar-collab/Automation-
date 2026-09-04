export function analyzeChannel(channel,videos=[]){return {niche:channel.niche||null,audience:channel.audience||null,topics:[...new Set(videos.map(v=>v.title).filter(Boolean))].slice(0,20)}}
