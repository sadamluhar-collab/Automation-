import {rpc} from '../database/transactions.js';export async function claimJob(workerId){const rows=await rpc('claim_next_job',{p_worker_id:workerId});return rows?.[0]||null}
