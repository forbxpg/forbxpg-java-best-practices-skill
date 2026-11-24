---
name: java-design-decisions
description: Decisions to settle before writing code for a Java / Spring Boot change. Use when planning, grilling, designing or writing a spec or plan for a feature, endpoint, entity, integration or refactoring in a Java project - it lists the API, data, integration, transaction, testing and rollout questions, the project's default answer for each, and which ones only the user can decide.
---

# Java design decisions

Use this while a change is still being designed — in a grillspec grill, a design
discussion or a spec — before any `.java` file is written. It turns "build feature X" into
explicit decisions. It does not replace your process: record the decisions wherever your
process keeps them (grillspec decision log, spec, ticket).

## Workflow

1. Read the passport line (Java, Boot, Lombok, MapStruct, Liquibase / Flyway, web stack)
   and the code the change touches.
2. Go through the groups below. For each question that applies:
   - a **fact** (what the code or the pom already says) — look it up, do not ask;
   - a **default** (the column below) — state it as an assumption the user can override;
   - a **decision** — ask the user, with your recommendation first and the trade-off.
3. Skip groups the change does not touch; say in one line which ones you skipped.
4. Output the decision list (format at the end) for the spec or the decision log.

## Questions by group

| Group | Question | Default (conventions) | Ask the user when |
|---|---|---|---|
| API | Which endpoints: method, path, status codes? | `/api/v1/<plural>`, 201 + `Location`, 204, 404, 409 | a path or a status code is not obvious |
| API | Request / response shape? | records `*Request` / `*Response` / `*Dto`, validation on components | fields are optional, nullable or computed |
| API | Error format? | `ProblemDetail` from the one advice | the API has clients with their own error contract |
| API | Breaking an existing contract? | never within a version | always — a breaking change is the user's call |
| API | Pagination and sorting? | `Pageable`, stable sort, capped page size | lists can be large or need keyset paging |
| Data | New or changed entities and relations? | LAZY to-one, `Set` for many, `@Version` when edited concurrently | ownership of a relation or cascade is unclear |
| Data | Schema change? | one new Liquibase changeset per change (Flyway file in Flyway projects) | data migration or backfill is needed |
| Data | Existing data affected? | additive, backwards-compatible schema | a column is dropped, renamed or made NOT NULL |
| Data | Read model? | projection or DTO query for lists | the query is analytical or hits a large table |
| Integration | Calling another service? | `client/` with `@HttpExchange` or the project's client type, timeouts from properties | the API, SLA or auth of the other side is unknown |
| Integration | Retries and idempotency? | retry only idempotent calls, bounded, with backoff | the call is a payment, a message or any POST |
| Integration | Failure of the other side? | map to a domain exception → 5xx / 503 | a fallback or degraded mode is expected |
| Transactions | Transaction boundary? | public service method; read-only for reads | one use case spans several services or systems |
| Transactions | Side effects after commit? | `@TransactionalEventListener(AFTER_COMMIT)` | messages must be exactly-once (outbox) |
| Async | Background or scheduled work? | `@Scheduled` job delegating to a service, idempotent | several instances run, or timing is business-critical |
| Concurrency | Concurrent edits? | optimistic locking → 409 | lost updates are expensive or must merge |
| Security | Who may call it? | existing security config, object-level checks | a new role, scope or data class is involved |
| Security | Personal or sensitive data? | not logged, not in `toString`, masked in errors | always mention it explicitly |
| Testing | Test levels? | unit for rules, `@WebMvcTest` / `@DataJpaTest` on H2, one `*IT` per endpoint | DB-specific SQL (H2 cannot prove it) or no Docker |
| Testing | Which cases prove it? | every rule positive + negative, from the contract | acceptance criteria are vague |
| Conventions | Any deviation from `java-conventions`? | none | the existing code does it differently |
| Gates | ArchUnit / Checkstyle rules affected? | none weakened | a rule blocks the design — the user decides |
| Rollout | Backwards compatibility and order of deploy? | schema first, code second, no breaking change | other services or a UI depend on it |
| Rollout | Feature flag or config switch? | none | the change must be dark-launched or reversible |

## Output

```markdown
### Java decisions — <change>
Facts: Boot 4.1, Java 21, Liquibase, MapStruct (passport); OrderService exists.
1. POST /api/v1/orders/{id}/cancellation → 204; 409 when SHIPPED. (default)
2. Order.status gets CANCELLED; changeset 014-add-cancelled-status. (default)
3. Refund via PaymentClient after commit, idempotency key = order id. (decided by user)
4. Tests: OrderServiceTest (rules), OrderControllerTest (400/404/409), OrderCancelIT. (default)
Skipped: async, security (no new roles), rollout (additive change).
Open: refund failure handling — waiting for the user.
```

Each line says whether it is a fact, a default or a user decision, so a reviewer can see
which choices were made on the user's behalf.

## Gotchas

- Do not design what the code already decides: read the existing service, entity and
  advice first.
- A default is not a decision: list it so the user can override it.
- Breaking API or schema changes, weaker gates, new roles and sensitive data are always the
  user's decision, never a default.
- After the decisions are approved, implementation follows the other skills:
  `java-conventions`, `spring-boot-service`, `spring-data-jpa`, `java-testing`.
