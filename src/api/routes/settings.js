export function get(req,res){res.json({success:true,data:{user_id:req.user.id,role:req.user.app_metadata?.role||'user'}})}
