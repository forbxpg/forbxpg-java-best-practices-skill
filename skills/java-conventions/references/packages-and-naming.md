# Packages and naming

## Where a type goes

| You are writing | Package | Name |
|---|---|---|
| REST endpoint | `controller` | `OrderController` |
| Business operation, transaction boundary | `service` | `OrderService` |
| Use case that coordinates several services | `facade` | `CheckoutFacade` |
| Spring Data repository | `repository` | `OrderRepository` |
| JPA entity and its enums | `entity` | `Order`, `OrderStatus` |
| Request / response / internal transfer object | `dto` | `CreateOrderRequest`, `OrderResponse`, `OrderDto` |
| MapStruct mapper | `mapper` | `OrderMapper` |
| Domain exception | `exception` | `OrderNotFoundException` |
| The `@RestControllerAdvice` | `exception` | `GlobalExceptionHandler` |
| `@Configuration`, beans, `@ConfigurationProperties` | `config` | `HttpClientConfig`, `OrderProperties` |
| Client for another service (RestClient, `@HttpExchange`, Feign) | `client` | `PaymentClient`, `PaymentClientConfig` |
| Scheduled job | `service` (or `job` when there are several) | `ExpiredOrderCleanupJob` |

When a package grows past ~10 types of one feature, add a sub-package per feature
inside the layer: `service/order/`, `service/payment/`. Keep the layer at the top.

## Multi-module projects

The team's multi-module layout is `core` (domain, services, persistence), `app`
(Spring Boot application, configuration), `web` (controllers, DTOs), `dist`
(packaging). Dependencies point inward: `web → core`, `app → web, core`; `core` depends
on no other module. Put a new type in the innermost module that has everything it needs.

## Naming

- Classes: nouns in `PascalCase`; the suffix is the role (`*Service`, `*Repository`).
- Methods: verbs — `create`, `findByNumber`, `cancel`, `toDto`. Boolean methods read
  as questions: `isExpired`, `hasItems`, `canCancel`.
- Repository methods follow Spring Data naming: `findByStatusAndCreatedAtBefore`.
- Tests: `OrderServiceTest`; methods describe behaviour:
  `cancel_rejectsShippedOrder()` or `rejectsShippedOrder()` — follow the project.
- No abbreviations except well-known ones (`id`, `dto`, `url`, `http`).
- Liquibase files: `changes/NNN-<what>.xml`, three-digit sequence, kebab-case.

## Test layout

`src/test/java` mirrors `src/main/java`. Unit and slice tests end in `Test`; tests that
start the whole application end in `IT`. Test data builders live in the test tree.
