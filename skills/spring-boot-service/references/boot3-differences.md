# Spring Boot 3 vs 4

The team's projects are on Boot 4.0 / 4.1. Use this table when a project is on Boot 3,
or when you migrate.

| Topic | Boot 3.x | Boot 4.x |
|---|---|---|
| Spring Framework | 6.x | 7.x (JSpecify null-safety annotations) |
| Jakarta EE | 10 | 11 |
| Web starter | `spring-boot-starter-web` | `spring-boot-starter-webmvc` |
| Test starters | `spring-boot-starter-test` | plus a test starter per technology (`spring-boot-starter-webmvc-test`, `…-data-jpa-test`) |
| JSON | Jackson 2 (`com.fasterxml.jackson.databind`) | Jackson 3 (`tools.jackson.databind`); annotations stay in `com.fasterxml.jackson.annotation` |
| Mock beans in tests | `@MockBean` (deprecated from 3.4) / `@MockitoBean` (3.4+) | `@MockitoBean` only — `@MockBean` is removed |
| HTTP test client | `MockMvc`, `TestRestTemplate`, `WebTestClient` | adds `RestTestClient` |
| Retry | Spring Retry / Resilience4j | `@Retryable`, `@ConcurrencyLimit` in Spring Framework (`@EnableResilientMethods`) |
| Liquibase / Flyway | dependency + auto-configuration | dedicated starters (`spring-boot-starter-liquibase`, `spring-boot-starter-flyway`) |

## Rules that follow

- `javax.*` (persistence, validation, servlet) is wrong on both: Boot 3 already uses
  `jakarta.*`. The hook blocks new `javax` imports.
- On Boot 4 the hook blocks `@MockBean` / `@SpyBean`; use `@MockitoBean` /
  `@MockitoSpyBean`.
- Custom Jackson code on Boot 4: inject `JsonMapper`; `@JsonComponent` became
  `@JacksonComponent`. Jackson 2 modules on the classpath are ignored by Boot 4's
  auto-configuration.
- After any migration, check the starters actually present: a starter only in test
  scope, or a removed auto-configuration, compiles and then fails at runtime.

## Migrating 3 → 4 (outline)

1. Move to the latest Boot 3.5 first and remove all deprecation warnings.
2. Switch the parent to 4.x; rename starters; add the per-technology test starters.
3. Replace `@MockBean`, Jackson 2 customisations, and removed properties (the
   `spring-boot-properties-migrator` dependency reports renamed keys at startup;
   remove it afterwards).
4. Run the full build and the application; check Actuator health and one request per
   endpoint group.
