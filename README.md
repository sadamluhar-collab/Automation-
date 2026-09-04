# Automation Platform

Production-oriented, multi-channel YouTube automation foundation using Supabase PostgreSQL as the source of truth and disposable workers.

## Principles
- DB-backed durable queue; no Redis/KV dependency.
- One pipeline engine for Manual and Auto modes.
- Tenant/channel isolation enforced in application code and PostgreSQL RLS.
- Checkpoint, lease, retry, idempotency and dead-letter handling.
- Provider adapters fail closed when credentials are missing; no fake production data.
- Media is stored in Supabase Storage, never Git.

## Run
1. Copy `.env.example` to `.env` and configure Supabase.
2. Apply `supabase/migrations` in order.
3. `node src/server.js`
4. Run a worker with `node src/workers/worker.js`.

See `docs/` for architecture and operations.
