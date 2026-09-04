-- Runtime data has one authoritative source: Supabase/Postgres.
-- GitHub stores this schema/code; Render runs the GitHub revision.
-- This ledger records every application-state INSERT/UPDATE/DELETE in one place.

create table if not exists public.data_change_events (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
  row_id text,
  row_before jsonb,
  row_after jsonb,
  changed_at timestamptz not null default now()
);

create index if not exists data_change_events_changed_at_idx
  on public.data_change_events(changed_at desc);
create index if not exists data_change_events_table_changed_at_idx
  on public.data_change_events(table_name, changed_at desc);

alter table public.data_change_events enable row level security;
drop policy if exists data_change_events_client_deny on public.data_change_events;
create policy data_change_events_client_deny
  on public.data_change_events for all to anon, authenticated
  using (false) with check (false);

create or replace function public.record_data_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  rid text;
begin
  if tg_op = 'DELETE' then
    rid := coalesce(to_jsonb(old)->>'id', to_jsonb(old)->>'uuid', '');
    insert into public.data_change_events(table_name, operation, row_id, row_before)
      values (tg_table_name, tg_op, rid, to_jsonb(old));
    return old;
  elsif tg_op = 'UPDATE' then
    rid := coalesce(to_jsonb(new)->>'id', to_jsonb(new)->>'uuid', '');
    insert into public.data_change_events(table_name, operation, row_id, row_before, row_after)
      values (tg_table_name, tg_op, rid, to_jsonb(old), to_jsonb(new));
    return new;
  else
    rid := coalesce(to_jsonb(new)->>'id', to_jsonb(new)->>'uuid', '');
    insert into public.data_change_events(table_name, operation, row_id, row_after)
      values (tg_table_name, tg_op, rid, to_jsonb(new));
    return new;
  end if;
end;
$$;

revoke all on function public.record_data_change() from public, anon, authenticated;
grant execute on function public.record_data_change() to service_role;

DO $$
declare
  t text;
begin
  foreach t in array ARRAY[
    'channels','channel_memory','channel_memory_versions','projects','project_versions',
    'pipeline_runs','pipeline_steps','scenes','scene_versions','automation_jobs','job_items',
    'faults','recovery_attempts','commands','schedules','analytics','artifacts'
  ] loop
    execute format('drop trigger if exists trg_record_data_change on public.%I', t);
    execute format(
      'create trigger trg_record_data_change after insert or update or delete on public.%I for each row execute function public.record_data_change()',
      t
    );
  end loop;
end $$;
