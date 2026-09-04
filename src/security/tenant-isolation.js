export function assertTenant(userId,resource){if(!resource||resource.user_id!==userId)throw Object.assign(new Error('Resource not found'),{status:404,code:'NOT_FOUND'});return true}
