create or replace function public.claim_next_job(p_worker_id text)
returns setof public.automation_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  j public.automation_jobs;
begin
  -- Recover jobs whose worker disappeared and whose lease expired.
  update public.automation_jobs
  set status = 'queued',
      worker_id = null,
      lease_until = null,
      updated_at = now()
  where status = 'running'
    and lease_until is not null
    and lease_until < now();

  update public.automation_jobs
  set status = 'running',
      worker_id = p_worker_id,
      lease_until = now() + interval '90 seconds',
      updated_at = now()
  where id = (
    select id
    from public.automation_jobs
    where status = 'queued'
      and (next_attempt_at is null or next_attempt_at <= now())
    order by priority asc, created_at asc
    for update skip locked
    limit 1
  )
  returning * into j;

  if j.id is not null then
    return next j;
  end if;
end;
$$;
