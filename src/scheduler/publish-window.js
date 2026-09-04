export const withinWindow=(publishAt,hours=5)=>new Date(publishAt).getTime()-Date.now()<=hours*3600000;
