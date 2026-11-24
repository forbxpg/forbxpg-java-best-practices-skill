# Correctness checklist

## Null and absence
- [ ] Inputs validated at the boundary; no `NullPointerException` path from an optional
      field, a missing map key or an empty `Optional.get()`.
- [ ] `Optional` used as a return type only; `orElseThrow` with a domain exception.
- [ ] Collections returned are never `null`.

## Exceptions
- [ ] No swallowed exceptions (empty `catch`, `catch` that only logs and continues where
      the caller needs to know).
- [ ] Cause kept when wrapping (`new XException(msg, e)`).
- [ ] Checked exceptions inside `@Transactional` either roll back (`rollbackFor`) or are
      converted to unchecked ones.
- [ ] Resources closed with try-with-resources.

## Equality and identity
- [ ] `equals` and `hashCode` consistent; entities compare by id; no `==` on boxed
      numbers or strings.
- [ ] `BigDecimal` compared with `compareTo`; scale and rounding explicit
      (`setScale(2, RoundingMode.HALF_EVEN)`).

## Time
- [ ] `Instant` / `OffsetDateTime` across system boundaries; `LocalDate` only for
      calendar dates.
- [ ] "Now" from an injected `Clock`; time zone explicit, never the server default.
- [ ] Boundaries: inclusive / exclusive ranges, end of month, DST change.

## Logic
- [ ] Every branch of a `switch` over an enum or sealed type handled (no silent `default`).
- [ ] Off-by-one in loops, pagination, substring and ranges.
- [ ] State transitions guarded (cannot ship a cancelled order).
- [ ] Idempotency where retries or duplicates can happen (messages, jobs, POST with
      retries).
- [ ] Integer overflow on sums and counters (`Math.addExact`, `long`).

## Spring specifics
- [ ] No self-invocation of `@Transactional` / `@Async` / `@Cacheable` methods.
- [ ] Transactions short; no remote call inside one.
- [ ] Beans stateless; configuration read from properties, not hard-coded.
