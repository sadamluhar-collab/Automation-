export function performance(a){const views=Number(a.views||0),likes=Number(a.likes||0),comments=Number(a.comments||0);return {engagement:views?(likes+comments)/views:0,views,likes,comments}}
