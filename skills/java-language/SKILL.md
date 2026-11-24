---
name: java-language
description: Modern Java 21 and 25 language and library practice independent of Spring. Use when writing or refactoring plain Java - records, sealed types, switch and record patterns, Optional and null handling, exceptions, collections and streams, immutability, virtual threads, CompletableFuture, thread safety - or when asked what a Java version allows.
---

# Modern Java (21 baseline, 25 aware)

The passport tells the Java version. Java 21 is the team's baseline; one project is on 25.
Do not use a feature newer than the project's version, and never enable preview
features unless the build already does.

## Workflow

1. Check the version in the passport (`Java 21` / `Java 25`).
2. Model data first: records for values, sealed interfaces for closed alternatives,
   enums for fixed sets.
3. Write behaviour as small methods over those types; prefer `switch` with patterns over
   `instanceof` chains.
4. Decide failure handling: exceptions per [exceptions](references/exceptions.md).
5. Shared state or async work? Read [concurrency](references/concurrency.md) first.
6. Compile after each class.

## MUST

- Records for immutable data carriers; validate in the compact constructor.
- `final` fields by default; immutable collections out (`List.copyOf`, `Stream.toList()`).
- `Optional` only as a return type for "maybe absent"; never as a field or parameter,
  never `Optional.get()` without a check — use `orElseThrow(() -> new XNotFound(id))`.
- `switch` over sealed types and enums without `default`, so the compiler reports a
  missing case.
- `equals` / `hashCode` together, or a record.
- `var` only when the type is obvious from the right-hand side.
- `BigDecimal` for money (`compareTo`, not `equals`); `java.time` for dates
  (`Instant` / `OffsetDateTime` across systems, an injected `Clock` for "now").

## MUST NOT

- Return `null` for collections — return empty ones.
- Catch `Exception` / `Throwable` to ignore it; swallow `InterruptedException`.
- Mutate a collection while iterating it; share a mutable collection between threads.
- Use `new Date()`, `SimpleDateFormat`, `Calendar` in new code.
- Use streams for side effects (`forEach` that mutates outside state) — use a loop.

## Examples

```java
public sealed interface PaymentResult permits Approved, Declined, Pending {}
public record Approved(String transactionId) implements PaymentResult {}
public record Declined(String reason) implements PaymentResult {}
public record Pending(Instant retryAt) implements PaymentResult {}

String describe(PaymentResult result) {
    return switch (result) {
        case Approved a -> "approved " + a.transactionId();
        case Declined(String reason) -> "declined: " + reason;
        case Pending p -> "retry at " + p.retryAt();
    };
}
```

```java
public record Money(BigDecimal amount, Currency currency) {
    public Money {
        Objects.requireNonNull(amount, "amount");
        Objects.requireNonNull(currency, "currency");
        if (amount.signum() < 0) throw new IllegalArgumentException("amount must not be negative");
    }
}
```

## References

| Reference | Load when |
|---|---|
| [modern-java](references/modern-java.md) | records, sealed types, patterns, collections, streams, text blocks |
| [exceptions](references/exceptions.md) | designing or handling exceptions |
| [concurrency](references/concurrency.md) | threads, virtual threads, `CompletableFuture`, locks, thread safety |
| [java25](references/java25.md) | the project is on Java 25, or a feature's availability is in question |

## Gotchas

- Record accessors are `name()`, not `getName()`; frameworks that expect getters (old
  Jackson setups, some mappers) need configuration.
- A record with a mutable component (`List`) is not immutable unless you copy it.
- `Stream.toList()` returns an unmodifiable list; `Collectors.toList()` does not promise
  either way.
- Unnamed variables `_` are final in Java 22+: on Java 21 they are a preview feature.
