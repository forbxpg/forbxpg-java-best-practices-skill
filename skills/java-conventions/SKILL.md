---
name: java-conventions
description: Team conventions for Java / Spring Boot code layout and naming. Use before creating a class, package, Maven module or new project, and when asked where something belongs, how to name it, which Lombok annotations to use, how to shape DTOs and mappers, or how to lay out application.yml and profiles.
---

# Java conventions

These are the team's conventions, taken from its Maven / Spring Boot 4 projects. When
the project you are in does it differently and consistently, follow the project and
say so once.

## Workflow

1. Read the passport line (`Maven · Java 21 · Boot 4.1 · Lombok · MapStruct …`).
2. Find where the new type belongs: [packages-and-naming](references/packages-and-naming.md).
3. Pick the type's shape: record, `@Service` class, `@Entity`, `@Mapper` interface…
4. Apply the Lombok rules for that role: [lombok](references/lombok.md).
5. DTO or mapper? [dto-and-mapping](references/dto-and-mapping.md).
6. New setting? [configuration](references/configuration.md).
7. Write one file, compile (`./mvnw -q compile`), then the next.

## Layout at a glance

```
src/main/java/<base>/
├── <App>Application.java
├── config/       @Configuration, @ConfigurationProperties records, client beans
├── controller/   @RestController — HTTP only
├── dto/          records: *Dto, *Request, *Response
├── entity/       @Entity classes and their enums
├── exception/    domain exceptions + the one @RestControllerAdvice
├── mapper/       MapStruct @Mapper interfaces
├── repository/   Spring Data interfaces
├── service/      @Service classes: business logic, transactions
└── client/       outbound HTTP clients (only when the service calls other services)
src/main/resources/
├── application.yml, application-<profile>.yml
└── db/changelog/ db.changelog-master.yaml + changes/NNN-<what>.xml
src/test/java/<base>/  mirrors main; *Test for unit and slice tests, *IT for full-context tests
```

## MUST

- One top-level type per file. A group of related types gets a sub-package, not a
  longer file (`service/order/`, `exception/order/`).
- Services: concrete classes, `@Service @RequiredArgsConstructor`, `@Slf4j` when they log.
- DTOs: records. Entities never cross the controller boundary.
- Names say the role: `OrderController`, `OrderService`, `OrderRepository`,
  `OrderMapper`, `OrderDto`, `CreateOrderRequest`, `OrderNotFoundException`,
  `OrderProperties`.
- Constants in `UPPER_SNAKE_CASE`; packages lower case, no underscores.

## MUST NOT

- `*Impl` + interface for a single implementation.
- `utils` / `common` dumping grounds for business logic. A helper used by one class
  stays private in that class.
- `@Data` on an entity, `@SneakyThrows`, `@Autowired` on a field.
- Hard-coded URLs, credentials or hosts in code; they go to configuration.

## Gotchas

- Lombok + MapStruct need `lombok-mapstruct-binding` in `annotationProcessorPaths`,
  after `lombok` and `mapstruct-processor`, or getters are missing at map time.
- `@Builder` on a class with `@NoArgsConstructor` also needs `@AllArgsConstructor`.
- A record already has `equals`, `hashCode`, `toString` and accessors: no Lombok on
  records.
- `@ConfigurationProperties` records need `@ConfigurationPropertiesScan` (or
  `@EnableConfigurationProperties`) once in the application.
