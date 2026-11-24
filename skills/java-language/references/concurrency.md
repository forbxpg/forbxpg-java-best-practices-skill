# Concurrency

## First question: is state shared?

Most Spring beans are singletons used by many request threads at once. A bean must be
**stateless** or hold only thread-safe, effectively immutable state (final fields set in
the constructor). A mutable field in a `@Service` is a bug waiting for load.

## Choosing a tool

| Need | Use |
|---|---|
| Many blocking I/O tasks (HTTP, DB) | virtual threads: `Executors.newVirtualThreadPerTaskExecutor()`, or `spring.threads.virtual.enabled: true` |
| CPU-bound parallel work | a bounded platform pool (`Executors.newFixedThreadPool(n)`) |
| Combine async results | `CompletableFuture` with an explicit executor |
| Counter / flag shared between threads | `AtomicLong`, `AtomicBoolean`, `LongAdder` |
| Map shared between threads | `ConcurrentHashMap` with `compute` / `merge` |
| Mutual exclusion | `ReentrantLock` (works well with virtual threads) or `synchronized` for short, non-blocking sections |
| Run once at a time across instances | a database lock or ShedLock, not a JVM lock |

## Virtual threads (21)

- Cheap: one per task, never pool them.
- Blocking is fine; long CPU work is not their job.
- Avoid holding a lock across blocking I/O; on Java 21 `synchronized` around blocking
  calls pins the carrier thread (fixed in Java 24+), prefer `ReentrantLock`.
- `ThreadLocal` per virtual thread multiplies memory; do not cache heavy objects in
  `ThreadLocal`.

## CompletableFuture

```java
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    var customer = CompletableFuture.supplyAsync(() -> customers.get(id), executor);
    var orders = CompletableFuture.supplyAsync(() -> orderClient.list(id), executor);
    return customer.thenCombine(orders, Summary::new).orTimeout(5, TimeUnit.SECONDS).join();
}
```

- Always pass an executor; the common pool is shared by the whole JVM.
- Always set a timeout (`orTimeout`, `completeOnTimeout`).
- `join()` wraps failures in `CompletionException`: unwrap the cause when handling.

## Spring specifics

- `@Async` needs `@EnableAsync` and a configured executor; it returns `void` or
  `CompletableFuture`. Calling an `@Async` method from the same class runs it
  synchronously (proxy bypass).
- `@Transactional` does not cross threads: work submitted to another thread runs
  outside the caller's transaction.
- `@Scheduled` jobs share one scheduler thread by default: set
  `spring.task.scheduling.pool.size` when there are several jobs.

## Review checklist

- [ ] No mutable instance fields in singletons (or they are thread-safe and justified).
- [ ] Check-then-act on shared state is atomic (`computeIfAbsent`, not `get` + `put`).
- [ ] Executors are bounded or virtual, and shut down (`try`-with-resources).
- [ ] Every wait has a timeout.
- [ ] `InterruptedException` restores the interrupt flag.
