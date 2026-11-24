# Test review

## Coverage of behaviour (not lines)
- [ ] Each new rule has a test that fails without it — try it: break the guarded line
      mentally (or really) and check a test goes red.
- [ ] Negative cases: invalid input, not found, conflict, forbidden, empty collections,
      boundary values.
- [ ] Bug fixes come with a test that reproduces the bug.

## Honest assertions
- [ ] Assertions check outcomes (returned values, saved state, HTTP status and body),
      not only that mocks were called.
- [ ] No assertion that copies the implementation's computation.
- [ ] No tests without assertions; no `assertTrue(result != null)` as the only check.
- [ ] Exceptions asserted by type and a meaningful part of the message or data.

## Right level
- [ ] Unit tests for logic; slices for web / JPA wiring; `*IT` for end-to-end flows.
- [ ] Mocks only for I/O collaborators; value objects and mappers run for real.
- [ ] DB-specific SQL verified against the real engine, or the gap stated (H2 limits).

## Stability
- [ ] No `Thread.sleep`, wall-clock time, random data without a seed, order dependence
      or shared mutable fixtures.
- [ ] No `@Disabled` added; no deleted or weakened assertions to make CI green.
- [ ] Test data fake; no real names, accounts, tokens or hosts.

## Readability
- [ ] Names describe behaviour; arrange / act / assert visible; builders for test data.
