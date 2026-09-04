# Architecture
Supabase PostgreSQL is authoritative. API handles auth/validation/control; workers claim DB-backed leases; pipeline state is persisted; providers are adapters behind routing; Realtime is a projection channel. Manual and Auto modes enqueue the same job types. Worker failure is recovered by lease expiry and reconciliation.
