alter table tenants enable row level security;alter table users enable row level security;alter table channels enable row level security;alter table channel_memory enable row level security;alter table projects enable row level security;alter table automation_jobs enable row level security;alter table artifacts enable row level security;alter table schedules enable row level security;alter table analytics enable row level security;
create policy users_self on users for select using (id=auth.uid());
create policy channels_tenant on channels for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy projects_channel on projects for all using (channel_id in(select id from channels where user_id=auth.uid())) with check (channel_id in(select id from channels where user_id=auth.uid()));
create policy jobs_user on automation_jobs for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy artifacts_tenant on artifacts for all using (tenant_id in(select tenant_id from users where id=auth.uid())) with check (tenant_id in(select tenant_id from users where id=auth.uid()));
create policy schedules_channel on schedules for all using (channel_id in(select id from channels where user_id=auth.uid())) with check (channel_id in(select id from channels where user_id=auth.uid()));
create policy analytics_channel on analytics for select using (channel_id in(select id from channels where user_id=auth.uid()));
