# Slice tests, full-context tests and H2

## Which test

| You test | Use | Starts |
|---|---|---|
| Controller mapping, validation, status codes, JSON, advice | `@WebMvcTest(OrderController.class)` + `MockMvc` | web layer only |
| Repository queries, mappings, Liquibase changesets | `@DataJpaTest` | JPA + H2 |
| JSON shape of a DTO | `@JsonTest` | JSON mappers |
| A client against a stub server | `@RestClientTest` or WireMock | client + converters |
| The whole flow through HTTP | `@SpringBootTest(webEnvironment = RANDOM_PORT)` named `*IT` | everything |

Boot 4 splits the slice annotations into per-technology test modules: add the matching
test starter (`spring-boot-starter-webmvc-test`, `spring-boot-starter-data-jpa-test`) and
import the annotation from it.

## @WebMvcTest

```java
@WebMvcTest(OrderController.class)
class OrderControllerTest {

    @Autowired MockMvc mvc;
    @MockitoBean OrderService orders;

    @Test
    void create_returns400ForBlankNumber() throws Exception {
        mvc.perform(post("/api/v1/orders").contentType(APPLICATION_JSON)
                        .content("""
                                {"number": " ", "customerId": 1, "lines": []}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").exists());
        verifyNoInteractions(orders);
    }

    @Test
    void get_returns404WhenMissing() throws Exception {
        when(orders.get(9L)).thenThrow(new OrderNotFoundException(9L));
        mvc.perform(get("/api/v1/orders/9")).andExpect(status().isNotFound());
    }
}
```

`@Autowired` on fields is fine in tests: the hook's field-injection rule (J1) applies to
production code only.

## @DataJpaTest on H2

```java
@DataJpaTest
class OrderRepositoryTest {

    @Autowired TestEntityManager em;
    @Autowired OrderRepository orders;

    @Test
    void findStaleWithCustomer_loadsCustomerInOneQuery() { ... }
}
```

- Runs each test in a rolled-back transaction; Liquibase builds the schema.
- Flush and clear (`em.flush(); em.clear();`) before asserting what the database holds,
  otherwise you read the persistence context.
- **H2 limits:** no PostgreSQL / Greenplum-specific types (`jsonb`, arrays), functions,
  `distributed by`, window-function quirks, locking semantics. A query that uses them
  needs a test against the real engine (Testcontainers when Docker is available) or is
  reported as "verified on H2 only".
- `MODE=PostgreSQL` in the H2 URL narrows the gap; it does not close it.

## Full-context tests (`*IT`)

- One shared configuration for all `*IT` classes so the context is cached.
- Test each endpoint a change touches end to end: request → database → response.
- External services stubbed (WireMock / `@MockitoBean` on the client).
