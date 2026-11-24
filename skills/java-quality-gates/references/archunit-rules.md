# CodeRulesTest rules

`assets/CodeRulesTest.java` holds 13 rules. Each failure message names the rule and how to
fix it. All rules use `allowEmptyShould(true)`, so a project without entities or
controllers still passes.

| Rule | Fails on | Fix |
|---|---|---|
| `j1_no_field_injection` | `@Autowired` field in production code | `@RequiredArgsConstructor` + `private final` |
| `j2_no_javax` | any use of `javax.persistence`, `javax.validation`, `javax.servlet` | the `jakarta.*` package |
| `j3_no_standard_streams` | `System.out`, `System.err`, `printStackTrace()` in production code | `@Slf4j` logging |
| `j5_no_junit4` | test code using `org.junit.Test` / `org.junit.runner` | JUnit 5 (`org.junit.jupiter.api`) |
| `w2_to_one_relations_are_lazy` | `@ManyToOne` / `@OneToOne` without `fetch = LAZY` | add `fetch = FetchType.LAZY` |
| `w3_enums_stored_by_name` | enum field in an `@Entity` without `@Enumerated(STRING)` | `@Enumerated(EnumType.STRING)` |
| `w4_transactional_methods_are_proxyable` | `@Transactional` on a private or final method | public, non-final method called from another bean |
| `w9_controllers_do_not_use_repositories` | a controller depending on a repository | call a service |
| `controllers_do_not_expose_entities` | a controller depending on an `@Entity` | DTO records |
| `services_do_not_depend_on_controllers` | a `@Service` referencing a controller | move the shared code to the service side |
| `repositories_do_not_depend_on_services` | a Spring Data repository referencing a `@Service` | move the logic to the service |
| `exception_handlers_live_in_the_advice` | `@ExceptionHandler` outside `@RestControllerAdvice` / `@ControllerAdvice` | move the handler to the advice |
| `services_do_not_return_response_entity` | a `@Service` method returning `ResponseEntity` | return a DTO; the controller builds the response |

Not in ArchUnit, covered by the hooks: `@Data` on entities (Lombok annotations are not in
bytecode), `@MockBean` on Boot 4 (the class no longer exists, so it does not compile).

## Verified behaviour

`tests/fixtures/gates-project` in this repository plants one violation per rule.
`mvn -B -ntp test` there fails with 13 failures, each caused by a planted class only.

## Adding a rule

1. Write it next to the others with a `because(...)` that says how to fix it.
2. Plant one violation in the fixture project, run it, see exactly that rule fail.
3. Run it on the real project; freeze existing violations if needed.
