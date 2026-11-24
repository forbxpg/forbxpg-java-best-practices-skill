# Configuration

## Files

- `src/main/resources/application.yml` holds defaults that work locally without secrets.
- One file per profile: `application-local.yml`, `application-e2e.yml`. No profile for
  "prod": production values come from the environment.
- Secrets, hosts and credentials come from environment variables or the platform's
  secret store: `${DB_PASSWORD}` without a default. Never commit real values.
- `spring.jpa.open-in-view: false`, `spring.jpa.hibernate.ddl-auto: validate` (Liquibase
  owns the schema), `server.shutdown: graceful`.

## Typed properties

Group related settings in a validated record instead of scattered `@Value`:

```java
@Validated
@ConfigurationProperties(prefix = "app.payment")
public record PaymentProperties(
        @NotNull URI baseUrl,
        @NotNull Duration connectTimeout,
        @NotNull Duration readTimeout,
        @Positive int maxRetries) {}
```

```yaml
app:
  payment:
    base-url: ${PAYMENT_BASE_URL:http://localhost:8081}
    connect-timeout: 2s
    read-timeout: 5s
    max-retries: 3
```

- Register once: `@ConfigurationPropertiesScan` on the application class.
- `@Value` is fine for a single unrelated setting; two or more settings for one
  concern become a properties record.
- Durations and sizes use Spring's types (`Duration`, `DataSize`) with units in YAML.
- A default that only makes sense locally (`localhost`) belongs in
  `application-local.yml`, not behind `${VAR:default}` in the main file.

## Gotchas

- Property keys in YAML are kebab-case; record components are camelCase. Spring binds
  them; do not mix styles in one file.
- An unknown key is silently ignored: check the spelling against the record or the
  Spring Boot reference.
- `@ConfigurationProperties` on a `@Component` class with `@Data` is the old style; new
  code uses a record.
