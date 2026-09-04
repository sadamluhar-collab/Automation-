export const can=(user,action)=>{const role=user?.app_metadata?.role||'user';return role==='admin'||(role==='user'&&!['DELETE_TENANT','ROTATE_SYSTEM_SECRETS'].includes(action))};
