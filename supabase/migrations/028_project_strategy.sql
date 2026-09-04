create table if not exists project_strategy(
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  project_id uuid not null unique references projects(id) on delete cascade,
  channel_id uuid not null references channels(id) on delete cascade,
  source_video_count int not null default 0,
  source_snapshot jsonb not null default '{}'::jsonb,
  channel_analysis jsonb not null default '{}'::jsonb,
  content_plan jsonb not null default '{}'::jsonb,
  provider text,
  model text,
  analyzed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists project_strategy_tenant_idx on project_strategy(tenant_id);
create index if not exists project_strategy_channel_idx on project_strategy(channel_id);
alter table project_strategy enable row level security;
create policy project_strategy_select on project_strategy for select using (project_id in (select id from projects where tenant_id in (select tenant_id from users where id=auth.uid())));
create policy project_strategy_insert on project_strategy for insert with check (project_id in (select id from projects where tenant_id in (select tenant_id from users where id=auth.uid())));
create policy project_strategy_update on project_strategy for update using (project_id in (select id from projects where tenant_id in (select tenant_id from users where id=auth.uid()))) with check (project_id in (select id from projects where tenant_id in (select tenant_id from users where id=auth.uid())));
create policy project_strategy_delete on project_strategy for delete using (project_id in (select id from projects where tenant_id in (select tenant_id from users where id=auth.uid())));
