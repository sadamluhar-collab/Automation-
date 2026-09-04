# Workers
Workers are stateless/disposable. They register, heartbeat, claim a leased job, checkpoint progress and complete it. A watchdog marks stale workers offline; lease expiry makes work claimable by another worker.
