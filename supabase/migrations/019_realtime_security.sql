-- Realtime: publish only application state that the client can safely observe.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['channels','channel_memory','projects','project_versions','pipeline_runs','pipeline_steps','scenes','scene_versions','automation_jobs','job_items','faults','recovery_attempts','commands','schedules','analytics','artifacts'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

ALTER TABLE channel_memory_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE scene_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE faults ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE commands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenants_self ON tenants;
CREATE POLICY tenants_self ON tenants FOR SELECT USING (id IN (SELECT tenant_id FROM users WHERE id=auth.uid()));
DROP POLICY IF EXISTS channel_memory_user ON channel_memory;
CREATE POLICY channel_memory_user ON channel_memory FOR ALL USING (channel_id IN (SELECT id FROM channels WHERE user_id=auth.uid())) WITH CHECK (channel_id IN (SELECT id FROM channels WHERE user_id=auth.uid()));
DROP POLICY IF EXISTS channel_memory_versions_user ON channel_memory_versions;
CREATE POLICY channel_memory_versions_user ON channel_memory_versions FOR ALL USING (channel_id IN (SELECT id FROM channels WHERE user_id=auth.uid())) WITH CHECK (channel_id IN (SELECT id FROM channels WHERE user_id=auth.uid()));
DROP POLICY IF EXISTS project_versions_user ON project_versions;
CREATE POLICY project_versions_user ON project_versions FOR ALL USING (project_id IN (SELECT p.id FROM projects p JOIN channels c ON c.id=p.channel_id WHERE c.user_id=auth.uid())) WITH CHECK (project_id IN (SELECT p.id FROM projects p JOIN channels c ON c.id=p.channel_id WHERE c.user_id=auth.uid()));
DROP POLICY IF EXISTS pipeline_runs_user ON pipeline_runs;
CREATE POLICY pipeline_runs_user ON pipeline_runs FOR ALL USING (project_id IN (SELECT p.id FROM projects p JOIN channels c ON c.id=p.channel_id WHERE c.user_id=auth.uid())) WITH CHECK (project_id IN (SELECT p.id FROM projects p JOIN channels c ON c.id=p.channel_id WHERE c.user_id=auth.uid()));
DROP POLICY IF EXISTS pipeline_steps_user ON pipeline_steps;
CREATE POLICY pipeline_steps_user ON pipeline_steps FOR ALL USING (pipeline_run_id IN (SELECT pr.id FROM pipeline_runs pr JOIN projects p ON p.id=pr.project_id JOIN channels c ON c.id=p.channel_id WHERE c.user_id=auth.uid())) WITH CHECK (pipeline_run_id IN (SELECT pr.id FROM pipeline_runs pr JOIN projects p ON p.id=pr.project_id JOIN channels c ON c.id=p.channel_id WHERE c.user_id=auth.uid()));
DROP POLICY IF EXISTS scenes_user ON scenes;
CREATE POLICY scenes_user ON scenes FOR ALL USING (project_id IN (SELECT p.id FROM projects p JOIN channels c ON c.id=p.channel_id WHERE c.user_id=auth.uid())) WITH CHECK (project_id IN (SELECT p.id FROM projects p JOIN channels c ON c.id=p.channel_id WHERE c.user_id=auth.uid()));
DROP POLICY IF EXISTS scene_versions_user ON scene_versions;
CREATE POLICY scene_versions_user ON scene_versions FOR ALL USING (scene_id IN (SELECT s.id FROM scenes s JOIN projects p ON p.id=s.project_id JOIN channels c ON c.id=p.channel_id WHERE c.user_id=auth.uid())) WITH CHECK (scene_id IN (SELECT s.id FROM scenes s JOIN projects p ON p.id=s.project_id JOIN channels c ON c.id=p.channel_id WHERE c.user_id=auth.uid()));
DROP POLICY IF EXISTS job_items_user ON job_items;
CREATE POLICY job_items_user ON job_items FOR ALL USING (job_id IN (SELECT id FROM automation_jobs WHERE user_id=auth.uid())) WITH CHECK (job_id IN (SELECT id FROM automation_jobs WHERE user_id=auth.uid()));
DROP POLICY IF EXISTS faults_user ON faults;
CREATE POLICY faults_user ON faults FOR ALL USING (tenant_id IN (SELECT tenant_id FROM users WHERE id=auth.uid())) WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id=auth.uid()));
DROP POLICY IF EXISTS recovery_attempts_user ON recovery_attempts;
CREATE POLICY recovery_attempts_user ON recovery_attempts FOR ALL USING (fault_id IN (SELECT f.id FROM faults f WHERE f.tenant_id IN (SELECT tenant_id FROM users WHERE id=auth.uid()))) WITH CHECK (fault_id IN (SELECT f.id FROM faults f WHERE f.tenant_id IN (SELECT tenant_id FROM users WHERE id=auth.uid())));
DROP POLICY IF EXISTS commands_user ON commands;
CREATE POLICY commands_user ON commands FOR ALL USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());

CREATE INDEX IF NOT EXISTS pipeline_runs_project_updated_idx ON pipeline_runs(project_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS pipeline_steps_run_updated_idx ON pipeline_steps(pipeline_run_id,status);
CREATE INDEX IF NOT EXISTS job_items_job_updated_idx ON job_items(job_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS faults_tenant_status_idx ON faults(tenant_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS commands_user_created_idx ON commands(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS schedules_channel_next_idx ON schedules(channel_id,enabled,next_run_at);
