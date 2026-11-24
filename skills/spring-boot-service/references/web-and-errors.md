# Web layer and errors

## Controllers

- `@RestController` + `@RequestMapping("/api/v1/<plural-noun>")`.
- Plural nouns, no verbs in paths: `POST /orders`, `POST /orders/{id}/cancellation`
  for an action that is not CRUD.
- Return the DTO directly with `@ResponseStatus` for fixed codes; `ResponseEntity` only
  when headers or the status vary (`201` with `Location`).
- Query parameters for filters, `Pageable` for paging: `GET /orders?status=NEW&page=0&size=20`.
- Return a page DTO (`content`, `page`, `size`, `totalElements`) or Spring Data's
  `PagedModel`, never a raw `Page` (its JSON shape is not stable).

## Validation

```java
public record CreateOrderRequest(
        @NotBlank @Size(max = 32) String number,
        @NotNull Long customerId,
        @NotEmpty List<@Valid OrderLineRequest> lines) {}
```

- `@Valid` on the `@RequestBody` parameter. Constraints on `@PathVariable` /
  `@RequestParam` (`@Positive Long id`) are validated by Spring MVC's built-in method
  validation (Spring Framework 6.1+) and reported as `HandlerMethodValidationException`
  through `ResponseEntityExceptionHandler`. Do **not** put `@Validated` on the controller:
  it switches to AOP validation, throws `ConstraintViolationException`, and the catch-all
  handler turns a 400 into a 500.
- Cross-field rules: a custom constraint on the record, or a check in the service that
  throws a domain exception.

## Errors as ProblemDetail (RFC 9457)

```java
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    @ExceptionHandler(OrderNotFoundException.class)
    ProblemDetail notFound(OrderNotFoundException e) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "Order not found");
        problem.setTitle("Order not found");
        problem.setProperty("orderId", e.getOrderId());
        return problem;
    }

    @ExceptionHandler(Exception.class)
    ProblemDetail unexpected(Exception e) {
        log.error("Unhandled error", e);
        return ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR, "Internal error");
    }
}
```

- Extending `ResponseEntityExceptionHandler` (or `spring.mvc.problemdetails.enabled: true`)
  turns Spring MVC's own errors (validation, missing parameters, wrong method) into
  ProblemDetail too.
- 4xx: a short, stable `title`; `detail` may name the input. No stack traces.
- 5xx: log once with the exception; the response never contains `e.getMessage()`.
- One advice per application. When a project already has several, extend the existing
  one instead of adding another.

## Security basics

- Validate and bound every input (sizes, lists, page size).
- Never log request bodies with personal data, tokens or passwords.
- Use parameter binding in queries; no string-built SQL or JPQL.
