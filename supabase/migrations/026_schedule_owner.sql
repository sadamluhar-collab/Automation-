alter table public.schedules add column if not exists user_id uuid references public.users(id) on delete cascade;
create index if not exists schedules_user_idx on public.schedules(user_id);
