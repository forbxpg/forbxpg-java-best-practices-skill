# Transactions and proxies

## Where transactions go

- On public methods of `@Service` classes. Not on controllers, not on repositories
  (Spring Data already makes their methods transactional).
- `@Transactional(readOnly = true)` for reads: no dirty checking and a read-only hint to
  the driver. `@Transactional` for writes.
- One use case = one transaction. A facade calling two services that must commit
  together opens the transaction itself.
- Keep transactions short: no HTTP calls, file I/O or waiting inside.

## The proxy rule

Spring adds `@Transactional`, `@Async`, `@Cacheable`, `@Retryable` and similar through a
proxy around the bean. The annotation only works when the call **comes through the
proxy**:

```java
@Service
@RequiredArgsConstructor
public class ReportService {

    public void rebuildAll() {
        ids().forEach(this::rebuild); // ❌ self-invocation: rebuild() runs without a transaction
    }

    @Transactional
    public void rebuild(Long id) { ... }
}
```

Fix by moving `rebuild` into another bean (`ReportRebuilder`) and injecting it. Do not
inject the bean into itself or use `AopContext`.

The annotation is also ignored on `private`, `final` and `static` methods.

## Rollback

- Unchecked exceptions roll back; checked exceptions commit unless
  `@Transactional(rollbackFor = Exception.class)`.
- Catching an exception inside the transaction and continuing still commits — and if an
  inner `@Transactional` method marked the transaction rollback-only, the commit fails
  with `UnexpectedRollbackException`.
- `REQUIRES_NEW` suspends the outer transaction and needs a second connection: use it
  only for audit-style writes that must survive a rollback.

## Side effects after commit

Send messages, e-mails or HTTP notifications after the data is committed:

```java
@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
void onOrderPlaced(OrderPlaced event) { notifications.send(event.orderId()); }
```

Publish with `ApplicationEventPublisher` inside the transaction.

## Caching

- `@Cacheable` keys must be stable and small; cache DTOs, not entities.
- Evict on every write path (`@CacheEvict`), or use short TTLs.
- Same self-invocation rule as transactions.
