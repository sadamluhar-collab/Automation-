alter table public.channels add column if not exists status text not null default 'pending';
alter table public.channels add column if not exists last_error text;
alter table public.channels add column if not exists analyzed_at timestamptz;
alter table public.channel_credentials add column if not exists token_type text default 'Bearer';
alter table public.channel_credentials add column if not exists revoked_at timestamptz;
create unique index if not exists channels_youtube_channel_id_uidx on public.channels(youtube_channel_id) where youtube_channel_id is not null;
