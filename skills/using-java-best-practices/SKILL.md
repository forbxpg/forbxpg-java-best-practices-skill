---
name: using-java-best-practices
description: Core rules for any Java or Spring Boot work in a Maven project (writing, editing, reviewing or testing .java files, pom.xml, application.yml, Liquibase changelogs). Always applies; it says which java-* or spring-* skill to load for the task at hand.
---

# Java best practices: core rules

The forbxpg-java hooks print a **project passport** at session start
(`Maven · Java 21 · Boot 4.1 · Lombok · MapStruct · Liquibase`). Write code for that
stack: Java and Boot versions, Lombok, MapStruct, Liquibase. When the passport says
`Quarkus` or `Jakarta EE: no specific rules`, follow the project's own code and use
only `java-language`.

## Rules that always hold

1. **Designing a change (grill, spec, plan)? Load `java-design-decisions` first.**
   **Writing code? Load `java-conventions` before you create a class, package, module or project.**
2. Packages by layer: `config, controller, dto, entity, exception, mapper, repository,
   service` (+ `client` for outbound HTTP, `facade` when one use case spans services).
3. Services are concrete `@Service` classes: no interface + `*Impl`.
4. Dependency injection: `@RequiredArgsConstructor` + `private final` fields. Never
   `@Autowired` on a field.
5. DTOs are records named `*Dto`; `*Request` / `*Response` only at the HTTP boundary.
   Controllers never take or return entities.
6. Entities: `@Getter @Setter @NoArgsConstructor(access = PROTECTED)`, never `@Data`;
   `fetch = LAZY` on `@ManyToOne` / `@OneToOne`; `@Enumerated(EnumType.STRING)`.
7. Mapping: MapStruct with `unmappedTargetPolicy = ReportingPolicy.ERROR` when the project
   has MapStruct; otherwise a static `from(...)` factory in the record.
8. Errors: domain exceptions → `ProblemDetail` in one `@RestControllerAdvice`.
9. Schema: a new Liquibase changeset per change; never edit one that reached `main`.
10. Logging: Lombok `@Slf4j`, placeholders `log.info("Order {} created", id)`, never
    `System.out` or `printStackTrace()`.
11. Tests: JUnit 5 + AssertJ; slices on H2; `@MockitoBean` (not `@MockBean`); never
    `@Disabled` a failing test.
12. **Small steps:** one class or file per step, compile after each step
    (`./mvnw -q compile`, or `mvn -q compile` without a wrapper).
13. **Never say "done", "tests pass" or "it builds" without build output** — see
    `java-verification`.

## Which skill when

| Task | Load |
|---|---|
| Planning, grilling or speccing a Java change (before code) | `java-design-decisions` |
| New class, package, module or project; naming; Lombok; DTO and mapping; config files | `java-conventions` |
| Plain Java: records, sealed types, pattern matching, Optional, exceptions, streams, concurrency | `java-language` |
| Controllers, services, validation, errors, HTTP clients, transactions, `@Async` / `@Scheduled` | `spring-boot-service` |
| Entities, repositories, queries, N+1, `LazyInitializationException`, Liquibase | `spring-data-jpa` |
| Writing or fixing tests, coverage | `java-testing` |
| Review a change, a PR or a class | `java-code-review` |
| Before claiming the build or tests pass | `java-verification` |
| Set up ArchUnit / Enforcer gates in a project | `java-quality-gates` |

## What the hooks do

- **Before a write** they block new hard violations (field `@Autowired`, `javax.*` on
  Boot 3+, `System.out`, `@MockBean` on Boot 4, JUnit 4, new `@Disabled`, editing an
  applied changeset or a gate config, `git push --force`, gates with `-DskipTests`). The
  message says how to fix it: fix and write again; do not work around the hook.
- **After a write** they report soft findings and the rules for the file's role. Act on
  them in the next step.
- **At the end of a turn** they compile what you changed and stop you on your own
  compile errors.
- After the conversation is compacted, they repeat these rules once: re-read your plan
  and notes before continuing.

## Working with the user

- Follow the project's existing code where it does not contradict a rule above; do not
  rewrite legacy code nobody asked you to touch.
- A hook rule is never worked around. If the user explicitly wants what a hook blocks,
  stop and ask them to make that change themselves or to add the rule id to `"disable"`
  in `forbxpg-java.json`.
