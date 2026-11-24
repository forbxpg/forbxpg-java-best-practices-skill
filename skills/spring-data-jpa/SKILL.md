---
name: spring-data-jpa
description: JPA / Hibernate entities, Spring Data repositories, queries and schema changes with Liquibase. Use when creating or changing an @Entity or repository, writing JPQL or native queries, fixing N+1 queries, LazyInitializationException, slow queries, optimistic locking, or adding a Liquibase changeset.
---

# Spring Data JPA and Liquibase

## Workflow

1. Schema first: a new Liquibase changeset ([liquibase](references/liquibase.md)).
   Hibernate only validates (`ddl-auto: validate`).
2. Entity matching the changeset ([entities](references/entities.md)).
3. Repository with the queries the use case needs
   ([queries-and-n-plus-1](references/queries-and-n-plus-1.md)).
4. Service method with the transaction; map to DTOs inside it.
5. `@DataJpaTest` for non-trivial queries (`java-testing`).

## MUST

- `@Getter @Setter @NoArgsConstructor(access = PROTECTED)` on entities; `equals` /
  `hashCode` on the id.
- `fetch = FetchType.LAZY` on every `@ManyToOne` and `@OneToOne`; collections are lazy
  by default — keep them lazy.
- `@Enumerated(EnumType.STRING)`.
- `@ManyToMany` and bidirectional `@OneToMany` collections as `Set`, with helper methods
  that keep both sides in sync.
- `@Version` on entities edited concurrently; a lost update becomes `409`.
- Load what a use case needs in one query: join fetch, `@EntityGraph` or a DTO
  projection.
- Paginate lists that can grow (`Pageable`, `Slice`).
- `spring.jpa.open-in-view: false`.

## MUST NOT

- `@Data`, `@EqualsAndHashCode`, `@ToString` on entities.
- `CascadeType.ALL` / `REMOVE` on `@ManyToOne` (deletes the parent).
- Entities in controllers or API responses.
- `ddl-auto: update` / `create` outside throwaway tests.
- Editing a changeset that reached `main`.
- String-concatenated JPQL or SQL.

## Example

```java
public interface OrderRepository extends JpaRepository<Order, Long> {

    @Query("""
            select o from Order o
            join fetch o.customer
            where o.status = :status and o.createdAt < :before
            """)
    List<Order> findStaleWithCustomer(OrderStatus status, Instant before);

    Page<OrderSummary> findByCustomerId(Long customerId, Pageable pageable);
}

public interface OrderSummary {
    Long getId();
    String getNumber();
    OrderStatus getStatus();
}
```

## References

| Reference | Load when |
|---|---|
| [entities](references/entities.md) | mapping fields, relations, ids, inheritance, locking |
| [queries-and-n-plus-1](references/queries-and-n-plus-1.md) | repository methods, JPQL, projections, N+1, lazy loading errors, bulk updates |
| [liquibase](references/liquibase.md) | any schema or reference-data change |

## Gotchas

- `LazyInitializationException` means the data was not loaded inside the transaction —
  fetch it in the query, do not turn on open-in-view or `EAGER`.
- `findAll()` + filtering in Java loads the whole table.
- `save()` on a managed entity is unnecessary inside a transaction; dirty checking
  flushes changes.
- Bulk `@Modifying` queries bypass the persistence context: clear it
  (`clearAutomatically = true`) or reload entities afterwards.
- `getReferenceById` returns a proxy without a query — fine for setting a relation,
  wrong when you read fields outside a transaction.
