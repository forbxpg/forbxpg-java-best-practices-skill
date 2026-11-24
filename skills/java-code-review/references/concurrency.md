# Concurrency review

- [ ] **Shared mutable state**: no mutable instance fields in singleton beans; caches are
      `ConcurrentHashMap` or a cache library, not `HashMap`.
- [ ] **Check-then-act** is atomic: `computeIfAbsent`, `putIfAbsent`, a database unique
      constraint or `UPDATE … WHERE status = 'NEW'` — not `if (!exists) insert`.
- [ ] **Lost updates** on entities edited concurrently: `@Version` or an atomic update.
- [ ] **Executors**: bounded or virtual-thread executors, closed after use; no
      `new Thread()` per request; no use of the common `ForkJoinPool` for blocking I/O.
- [ ] **Timeouts** on every wait: `future.get(timeout)`, `orTimeout`, HTTP read timeouts,
      lock `tryLock(timeout)`.
- [ ] **Interrupts**: `InterruptedException` restores the flag and stops the work.
- [ ] **Locks**: held for the shortest time; never across remote calls; ordered
      consistently when several are taken. On Java 21, no `synchronized` around blocking
      I/O on virtual threads (pinning).
- [ ] **@Async**: enabled, configured executor, exceptions handled, no self-invocation;
      no reliance on the caller's transaction or security context.
- [ ] **@Scheduled**: several instances do not run the same job twice (DB lock /
      ShedLock); jobs are idempotent; pool size set when there are several jobs.
- [ ] **Visibility**: flags shared between threads are `volatile` or atomic.
- [ ] **Thread-unsafe classes** not shared: `SimpleDateFormat`, `Random` under contention
      (use `ThreadLocalRandom`), non-thread-safe clients.

Prove a race with a test when you can: run the operation from N threads with a
`CountDownLatch` start and assert the invariant (no duplicates, correct total).
