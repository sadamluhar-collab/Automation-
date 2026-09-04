# Queue
PostgreSQL is the durable queue. Transactional `FOR UPDATE SKIP LOCKED` claiming prevents duplicate claims. Jobs carry priority, lease, checkpoint, retry count and idempotency key. Reconciliation requeues expired leases and due retries.
