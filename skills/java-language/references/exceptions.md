# Exceptions

## Design

- Domain failures are unchecked exceptions with a meaningful name and the data needed to
  act: `OrderNotFoundException(Long id)`, `InsufficientStockException(String sku, int requested, int available)`.
- One base class per service or domain when the advice needs to treat them alike
  (`abstract class DomainException extends RuntimeException`).
- Checked exceptions only when the caller can and must recover (rare in services).
- The message is for developers and logs; the HTTP response text comes from the
  exception handler, not from `getMessage()`.

```java
public class OrderNotFoundException extends RuntimeException {
    private final Long orderId;

    public OrderNotFoundException(Long orderId) {
        super("Order " + orderId + " not found");
        this.orderId = orderId;
    }

    public Long getOrderId() {
        return orderId;
    }
}
```

## Handling

- Catch where you can do something: retry, fall back, translate to a domain exception.
  Otherwise let it propagate to the advice.
- Wrap with the cause: `throw new DocumentReadException(path, e);` — never lose `e`.
- Log **or** rethrow, not both: the place that finally handles it logs once.
- `try`-with-resources for everything `AutoCloseable` (streams, readers, connections).
- `InterruptedException`: restore the flag (`Thread.currentThread().interrupt()`) and
  stop the work.
- Never catch `Throwable` or `Error`; catch `Exception` only at a boundary (a job runner,
  a message listener) and log it with the stack trace.

## Anti-patterns

```java
// ❌ swallowed
try { send(); } catch (Exception e) { }

// ❌ cause lost, message duplicated in every log line
catch (IOException e) { log.error("failed: " + e.getMessage()); throw new RuntimeException("failed"); }

// ✅
catch (IOException e) { throw new DocumentSendException(documentId, e); }
```

- Exceptions for control flow (`try { parse } catch → default`) when a check is cheap —
  check first.
- `@SneakyThrows` — hides a checked exception from every caller.
