create table if not exists public.drive_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  tenant_id uuid not null,
  email text,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  token_type text default 'Bearer',
  drive_root_folder_id text,
  status text not null default 'active' check (status in ('active','reauthorization_required','error')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);
create index if not exists drive_connections_tenant_idx on public.drive_connections(tenant_id);
alter table public.drive_connections enable row level security;
