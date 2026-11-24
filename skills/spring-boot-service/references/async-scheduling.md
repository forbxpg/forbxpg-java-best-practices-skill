# @Async and @Scheduled

## @Async

- Needs `@EnableAsync` once. Without it the method runs synchronously and nobody notices.
- Return `void` or `CompletableFuture<T>`; exceptions from `void` methods go to the
  `AsyncUncaughtExceptionHandler` — configure one that logs.
- Configure the executor (`spring.task.execution.pool.*`, or virtual threads with
  `spring.threads.virtual.enabled: true`).
- Self-invocation bypasses the proxy (see transactions-and-proxies).
- The caller's transaction and security context do not follow the task.

## @Scheduled

```java
@Slf4j
@Component
@RequiredArgsConstructor
public class ExpiredOrderCleanupJob {

    private final OrderService orders;

    @Scheduled(cron = "${app.cleanup.cron:0 0 3 * * *}", zone = "Europe/Moscow")
    public void run() {
        int removed = orders.removeExpired();
        log.info("Removed {} expired orders", removed);
    }
}
```

- Needs `@EnableScheduling` once.
- All jobs share one scheduler thread by default: with several jobs set
  `spring.task.scheduling.pool.size`.
- Several application instances run every job on every instance: guard jobs that must
  run once with a database lock (ShedLock) or a status column claimed with `UPDATE ... WHERE`.
- The job method delegates to a service; the transaction lives in the service.
- Cron and zone come from configuration; never rely on the server's default time zone.
- A job is idempotent: a rerun after a crash must not double-process.

## Testing

Call the job method directly in a test; do not wait for the scheduler. Test the
"already processed" path for idempotency.
