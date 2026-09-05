alter table public.channels add column if not exists status text not null default 'pending';
alter table public.channels add column if not exists last_error text;
alter table public.channels add column if not exists analyzed_at timestamptz;
alter table public.channel_credentials add column if not exists token_type text default 'Bearer';
alter table public.channel_credentials add column if not exists revoked_at timestamptz;

create unique index if not exists channels_youtube_channel_id_uidx on public.channels(youtube_channel_id) where youtube_channel_id is not null;

update public.channels set status='active' where youtube_channel_id is not null and coalesce(status,'')='pending';

create or replace function public.set_channel_status_on_memory()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.channels
  set status='active',analyzed_at=now(),last_error=null,updated_at=now()
  where id=new.channel_id;
  return new;
end;
$$;

drop trigger if exists trg_channel_memory_activates_channel on public.channel_memory;
create trigger trg_channel_memory_activates_channel
after insert or update on public.channel_memory
for each row execute function public.set_channel_status_on_memory();
