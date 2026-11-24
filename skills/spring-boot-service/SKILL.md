---
name: spring-boot-service
description: Spring Boot 4 (and 3) service code - REST controllers, request validation, error handling with ProblemDetail, services and transactions, proxy pitfalls (@Transactional, @Async, @Cacheable self-invocation), outbound HTTP clients (RestClient, @HttpExchange, Feign) with timeouts, @Async and @Scheduled, configuration beans and Actuator. Use when creating or changing controllers, services, clients or Spring configuration. For entities and queries use spring-data-jpa.
---

# Spring Boot services

## Workflow

1. Passport: Boot 4 or 3? Boot 3 differences are in
   [boot3-differences](references/boot3-differences.md).
2. Contract first: request / response records with validation (`java-conventions`).
3. Controller: HTTP mapping only → one service call.
4. Service: business rules and the transaction boundary.
5. Errors: domain exception → `ProblemDetail` in the advice.
6. Outbound calls: a client in `client/` with timeouts, never inside a transaction.
7. Compile, then a slice test (`java-testing`).

## MUST

- Constructor injection via `@RequiredArgsConstructor`; beans are stateless.
- `@Valid` on `@RequestBody`; validation annotations on record components.
- Status codes: `201` + `Location` for create, `204` for delete, `404` from
  `XNotFoundException`, `409` for conflicts, `400` for validation.
- Transactions on **public service methods**: `@Transactional(readOnly = true)` for
  reads, `@Transactional` for writes.
- Every outbound HTTP client has connect and read timeouts.
- `spring.jpa.open-in-view: false`; load what the response needs inside the service.

## MUST NOT

- Business logic, repositories or entities in controllers.
- `ResponseStatusException`, `ResponseEntity` or servlet types in services.
- An `@ExceptionHandler` inside a controller (it bypasses the global mapping).
- Remote calls (HTTP, messaging) inside `@Transactional`: the DB connection is held for
  the whole call.
- `RestTemplate` in new code; `RestClient.create()` / `new RestTemplate()` without
  timeouts.

## Example

```java
@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orders;

    @GetMapping("/{id}")
    public OrderDto get(@PathVariable Long id) {
        return orders.get(id);
    }

    @PostMapping
    public ResponseEntity<OrderDto> create(@Valid @RequestBody CreateOrderRequest request) {
        OrderDto created = orders.create(request);
        return ResponseEntity.created(URI.create("/api/v1/orders/" + created.id())).body(created);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancel(@PathVariable Long id) {
        orders.cancel(id);
    }
}
```

## References

| Reference | Load when |
|---|---|
| [web-and-errors](references/web-and-errors.md) | controllers, validation, ProblemDetail, pagination |
| [transactions-and-proxies](references/transactions-and-proxies.md) | `@Transactional`, self-invocation, `@Cacheable`, events |
| [http-clients](references/http-clients.md) | calling another service: RestClient, `@HttpExchange`, Feign, retries |
| [async-scheduling](references/async-scheduling.md) | `@Async`, `@Scheduled`, background work |
| [boot3-differences](references/boot3-differences.md) | the project is on Boot 3, or you migrate 3 → 4 |

## Gotchas

- A method calling another `@Transactional` / `@Async` / `@Cacheable` method of the
  **same class** bypasses the proxy: the annotation does nothing.
- `@Transactional` on a private or final method is ignored silently.
- Checked exceptions do not roll back by default: use `rollbackFor` or unchecked
  domain exceptions.
- Boot 4 uses Jackson 3 (`tools.jackson.*`); annotations stay in
  `com.fasterxml.jackson.annotation`. Inject `JsonMapper`, not a hand-built `ObjectMapper`.
