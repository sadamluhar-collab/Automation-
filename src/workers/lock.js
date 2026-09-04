export const leaseValid=(job)=>job?.lease_until&&new Date(job.lease_until)>new Date();
