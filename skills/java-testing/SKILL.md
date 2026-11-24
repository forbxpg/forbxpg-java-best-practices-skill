---
name: java-testing
description: Writing and fixing Java / Spring Boot tests - JUnit 5, AssertJ, Mockito, @WebMvcTest and @DataJpaTest slices on H2, @MockitoBean, Testcontainers when Docker is available, test data, negative cases. Use when asked to add, write, fix or improve tests or coverage, or when a test is flaky or tests the wrong thing.
---

# Java testing

## Workflow

1. Read the contract (method signature, endpoint, spec scenario) — **not** the
   implementation — and list cases: happy path, each rule's violation, boundaries
   (empty, one, many, max), absent data, concurrent change.
2. Pick the smallest test that proves each case:
   unit test → slice test → full-context `*IT` ([slices-and-h2](references/slices-and-h2.md)).
3. Write the test; run it; **watch it fail** when it is new behaviour.
4. Make it pass; run the module's suite.
5. Report with the build's own numbers (`java-verification`).

## MUST

- JUnit 5 (`org.junit.jupiter.api.Test`) + AssertJ (`assertThat`). One behaviour per
  test; the name says the behaviour.
- Arrange / act / assert, visibly separated.
- Positive **and** negative cases for every rule: invalid input, not found, conflict,
  forbidden.
- Assert outcomes (returned value, saved state, sent request, HTTP status and body), not
  that a mock was called — verify interactions only when the interaction is the outcome
  (a message sent, a payment requested).
- `@MockitoBean` / `@MockitoSpyBean` in Spring tests.
- Deterministic tests: inject a `Clock`, fix random seeds, no `Thread.sleep` — use
  Awaitility for async results.
- Test data through small builders or factory methods in the test tree.

## MUST NOT

- `@Disabled` a failing test (the hook blocks new ones) — fix the code or ask the user.
- JUnit 4 (`org.junit.Test`, `@RunWith`), `@MockBean` on Boot 4.
- Mock the class under test, value objects, or collections.
- Copy the implementation's logic into the assertion (the test then proves nothing).
- Share mutable state between tests; depend on test order.

## Example

```java
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock OrderRepository orders;
    @Mock PaymentClient payments;
    @InjectMocks OrderService service;

    @Test
    void cancel_rejectsShippedOrder() {
        Order shipped = OrderFixtures.order().status(OrderStatus.SHIPPED).build();
        when(orders.findById(7L)).thenReturn(Optional.of(shipped));

        assertThatThrownBy(() -> service.cancel(7L))
                .isInstanceOf(OrderNotCancellableException.class)
                .hasMessageContaining("SHIPPED");
        verifyNoInteractions(payments);
    }
}
```

## References

| Reference | Load when |
|---|---|
| [unit-and-mocks](references/unit-and-mocks.md) | unit tests, Mockito, AssertJ, test data, parameterized tests |
| [slices-and-h2](references/slices-and-h2.md) | `@WebMvcTest`, `@DataJpaTest`, full-context tests, H2 limits |
| [testcontainers](references/testcontainers.md) | the passport shows Docker and the project uses Testcontainers |

## Gotchas

- H2 does not catch PostgreSQL / Greenplum dialect differences (types, functions, JSON,
  window functions): a green `@DataJpaTest` on H2 does not prove the SQL runs in
  production. Say so when a change depends on such SQL.
- `@SpringBootTest` per test class with different mocks creates a new context each time
  — slow. Prefer slices; share one configuration for `*IT` tests.
- `@Transactional` on a test rolls back, so `@TransactionalEventListener(AFTER_COMMIT)`
  never fires in it.
- `assertThat(list).hasSize(2)` before inspecting elements gives a clearer failure.
