# Testcontainers

Use only when the passport shows Docker (`docker: true`) **and** the project already
depends on Testcontainers, or the user asks for it. On machines without a running Docker
daemon these tests cannot run: do not add them silently.

## Setup with @ServiceConnection

```java
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfig {

    @Bean
    @ServiceConnection
    PostgreSQLContainer<?> postgres() {
        return new PostgreSQLContainer<>("postgres:16-alpine");
    }
}

@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfig.class)
class OrderApiIT { ... }
```

- `@ServiceConnection` wires the datasource; no `@DynamicPropertySource` needed.
- One container per test run (shared configuration), not per class.
- Pin image tags; use the same major version as production.
- In a corporate network images come from the internal registry: configure
  `hub.image.name.prefix` in `~/.testcontainers.properties` or use fully qualified image
  names; never hard-code internal hosts in the repository.
- Testcontainers 2 renamed modules (`testcontainers-postgresql` instead of
  `postgresql`); follow the version the project's BOM brings.

## When to prefer it over H2

- Native queries, PostgreSQL / Greenplum types and functions.
- Locking, isolation and constraint behaviour.
- Liquibase changesets with database-specific SQL.

## Speed

- Reuse the Spring context across `*IT` classes (same configuration, same mocks).
- Keep slice tests on H2 for fast feedback; run `*IT` in `verify` (Failsafe).
