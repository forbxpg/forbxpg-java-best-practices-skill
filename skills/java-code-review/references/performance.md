# Performance review

Measure before optimising; review for the patterns that are slow at any size.

## Database (usually the biggest cost)
- [ ] **N+1**: a lazy relation touched in a loop or during DTO mapping. Fix with join
      fetch, `@EntityGraph` or a projection.
- [ ] Unbounded reads: `findAll()`, lists without paging, `IN (:ids)` with thousands of ids.
- [ ] Filtering, sorting or counting in Java what the database can do.
- [ ] Missing index for a new `WHERE` / `JOIN` / `ORDER BY` column (check the changeset).
- [ ] Saving in a loop instead of `saveAll` with JDBC batching
      (`hibernate.jdbc.batch_size`), or a bulk `UPDATE`.
- [ ] Large analytical reads through JPA entities instead of `JdbcClient` with streaming.

## Remote calls
- [ ] Calls in loops that could be batched or parallelised with a bounded executor.
- [ ] No timeouts; retries without backoff; retries of non-idempotent calls.

## Code
- [ ] String concatenation in loops (use `StringBuilder` or `joining`).
- [ ] Repeated work inside loops: regex compile, `ObjectMapper` creation, reflection.
- [ ] Wrong collection: `List.contains` in a loop (use a `Set`), `LinkedList` for random
      access, boxing in hot numeric loops.
- [ ] Logging that builds expensive strings at disabled levels (use placeholders).
- [ ] Loading whole files or results into memory when streaming would do.

## Caching
- [ ] A cache has a size bound and a TTL or eviction on writes; keys are small and
      stable; cached values are DTOs, not entities.

Report a performance finding with its scale: "one extra query per order line; 200 queries
for a 200-line order".
