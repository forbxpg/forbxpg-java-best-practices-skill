# Queries and N+1

## Choosing the query form

| Need | Use |
|---|---|
| Simple filter on 1–3 fields | derived method: `findByStatusAndCreatedAtBefore` |
| Joins, fetches, anything longer | `@Query` with JPQL in a text block |
| Read-only list for a screen or API | interface or record projection |
| Dynamic filters | `Specification` (`JpaSpecificationExecutor`) or a criteria query in a custom repository |
| Database-specific SQL | `@Query(nativeQuery = true)` with named parameters |
| Many rows changed at once | `@Modifying @Query("update ...")` |

## N+1

Symptom: one query for the list, then one more per row when a lazy relation is touched
(often in mapping to DTOs).

Fixes, in order of preference:

```java
// 1. join fetch for to-one relations and one collection
@Query("select o from Order o join fetch o.customer where o.status = :status")
List<Order> findByStatusWithCustomer(OrderStatus status);

// 2. entity graph on a derived method
@EntityGraph(attributePaths = {"customer", "lines"})
Optional<Order> findWithDetailsById(Long id);

// 3. projection: only the columns the response needs
@Query("select new com.example.shop.dto.OrderRowDto(o.id, o.number, c.name) from Order o join o.customer c")
List<OrderRowDto> findRows();
```

- Never join fetch two collections in one query (cartesian product,
  `MultipleBagFetchException` with lists).
- Join fetch + pagination of a collection paginates in memory (Hibernate warns
  `HHH90003004`): page the ids first, then fetch details for those ids.
- `spring.jpa.properties.hibernate.default_batch_fetch_size: 50` turns remaining N+1 into
  N/50 queries — a safety net, not a design.

## Seeing the queries

- Tests: `spring.jpa.show-sql: true` or `logging.level.org.hibernate.SQL: debug` with
  `org.hibernate.orm.jdbc.bind: trace` for parameters.
- Count statements in a test with Hibernate statistics
  (`hibernate.generate_statistics: true`) when a fix must stay fixed.

## Pagination

```java
Page<OrderSummary> findByCustomerId(Long customerId, Pageable pageable);  // + count query
Slice<OrderSummary> findByStatus(OrderStatus status, Pageable pageable);  // no count query
```

- Always a stable sort (add the id as a tie-breaker).
- Cap the page size (`spring.data.web.pageable.max-page-size`).
- Deep offsets are slow: use keyset pagination (`where id > :lastId order by id`) for
  exports and jobs.

## Bulk updates

```java
@Modifying(clearAutomatically = true, flushAutomatically = true)
@Query("update Order o set o.status = :status where o.createdAt < :before")
int expireOlderThan(OrderStatus status, Instant before);
```

Bulk updates skip `@Version`, entity listeners and cascades.

## Greenplum / analytical queries

Large analytical reads (views, functions, reporting) do not belong in JPA entities: use
`JdbcClient` / `NamedParameterJdbcTemplate` with row mappers or records, stream large
results, and set a fetch size.
