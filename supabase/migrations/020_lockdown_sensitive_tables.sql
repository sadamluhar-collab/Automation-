ALTER TABLE channel_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS channel_credentials_client_deny ON channel_credentials;
CREATE POLICY channel_credentials_client_deny ON channel_credentials FOR ALL USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS provider_configs_client_deny ON provider_configs;
CREATE POLICY provider_configs_client_deny ON provider_configs FOR ALL USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS provider_health_client_deny ON provider_health;
CREATE POLICY provider_health_client_deny ON provider_health FOR ALL USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS audit_logs_client_deny ON audit_logs;
CREATE POLICY audit_logs_client_deny ON audit_logs FOR ALL USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS workers_client_deny ON workers;
CREATE POLICY workers_client_deny ON workers FOR ALL USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS worker_heartbeats_client_deny ON worker_heartbeats;
CREATE POLICY worker_heartbeats_client_deny ON worker_heartbeats FOR ALL USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS artifact_versions_user ON artifact_versions;
CREATE POLICY artifact_versions_user ON artifact_versions FOR ALL USING (artifact_id IN (SELECT a.id FROM artifacts a WHERE a.tenant_id IN (SELECT tenant_id FROM users WHERE id=auth.uid()))) WITH CHECK (artifact_id IN (SELECT a.id FROM artifacts a WHERE a.tenant_id IN (SELECT tenant_id FROM users WHERE id=auth.uid())));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['channel_credentials','provider_configs','provider_health','audit_logs','workers','worker_heartbeats','artifact_versions'] LOOP
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
