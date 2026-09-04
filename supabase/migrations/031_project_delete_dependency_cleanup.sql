create or replace function public.delete_project(p_project_id uuid, p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  active_count integer;
begin
  if not exists (select 1 from public.projects where id = p_project_id and tenant_id = p_tenant_id) then
    raise exception 'Project not found';
  end if;

  select count(*) into active_count
  from public.automation_jobs
  where project_id = p_project_id
    and status in ('queued','running');

  if active_count > 0 then
    raise exception 'Project has active jobs';
  end if;

  -- Preserve audit/command/fault history while allowing project-owned jobs to be removed.
  update public.audit_logs set project_id = null, job_id = null where project_id = p_project_id;
  update public.commands set project_id = null, job_id = null where project_id = p_project_id;
  update public.faults set project_id = null, job_id = null where project_id = p_project_id;
  update public.worker_heartbeats set job_id = null where job_id in (select id from public.automation_jobs where project_id = p_project_id);
  update public.workers set current_job_id = null where current_job_id in (select id from public.automation_jobs where project_id = p_project_id);
  update public.automation_jobs set parent_job_id = null where project_id = p_project_id;

  delete from public.projects where id = p_project_id and tenant_id = p_tenant_id;

  return jsonb_build_object('deleted', true, 'project_id', p_project_id);
end;
$function$;
