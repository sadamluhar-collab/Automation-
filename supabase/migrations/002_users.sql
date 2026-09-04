create table if not exists tenants(id uuid primary key default gen_random_uuid(),name text not null,created_at timestamptz not null default now());
create table if not exists users(id uuid primary key references auth.users(id) on delete cascade,tenant_id uuid not null references tenants(id) on delete cascade,role text not null default 'user',created_at timestamptz not null default now());
