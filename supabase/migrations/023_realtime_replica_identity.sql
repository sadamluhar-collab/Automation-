-- Keep default replica identity for low write overhead. Primary keys are sufficient for
-- UI reconciliation; clients refetch the affected module when authoritative state is needed.
ALTER TABLE public.channels REPLICA IDENTITY DEFAULT;
ALTER TABLE public.channel_memory REPLICA IDENTITY DEFAULT;
ALTER TABLE public.projects REPLICA IDENTITY DEFAULT;
ALTER TABLE public.project_versions REPLICA IDENTITY DEFAULT;
ALTER TABLE public.pipeline_runs REPLICA IDENTITY DEFAULT;
ALTER TABLE public.pipeline_steps REPLICA IDENTITY DEFAULT;
ALTER TABLE public.scenes REPLICA IDENTITY DEFAULT;
ALTER TABLE public.scene_versions REPLICA IDENTITY DEFAULT;
ALTER TABLE public.automation_jobs REPLICA IDENTITY DEFAULT;
ALTER TABLE public.job_items REPLICA IDENTITY DEFAULT;
ALTER TABLE public.faults REPLICA IDENTITY DEFAULT;
ALTER TABLE public.recovery_attempts REPLICA IDENTITY DEFAULT;
ALTER TABLE public.commands REPLICA IDENTITY DEFAULT;
ALTER TABLE public.schedules REPLICA IDENTITY DEFAULT;
ALTER TABLE public.analytics REPLICA IDENTITY DEFAULT;
ALTER TABLE public.artifacts REPLICA IDENTITY DEFAULT;
