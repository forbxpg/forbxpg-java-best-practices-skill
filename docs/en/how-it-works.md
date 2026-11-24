# How it works

One entry point, `hooks/java-hooks.mjs <Event> --harness claude|gigacode|codex`, reads the
hook input from stdin and dispatches to `hooks/lib/`. Outside a Maven project (no
`pom.xml`) every hook exits 0 silently. Any internal error also exits 0 (fail open) and is
logged to `<tmp>/forbxpg-java/<project>/<session>/hook.log`. Hooks never write inside the
project.

## Project passport

`passport.mjs` reads the root and module `pom.xml` files: Java and Boot versions, Lombok,
MapStruct, Liquibase / Flyway, H2, Testcontainers, web stack, quality plugins, modules,
wrapper, Docker availability. It is cached per project by the pom's mtime and size.

## Before a write (PreToolUse)

For `write_file` / `edit` (GigaCode), `Write` / `Edit` / `MultiEdit` (Claude) the hook
rebuilds the file as it will be after the write, finds rule violations in the current and
the resulting text, and blocks only the **new** hard ones (exit 2, message on stderr). It
also refuses edits to Liquibase changesets already on `main` (G1), to gate configs (G2),
and shell commands that destroy work or skip gates (S1, S2).

Every hard message ends with "if the user explicitly asked for this, stop and ask…": the
model must not retry or work around a block; the user decides (`disable` in
`forbxpg-java.json`). G1 allows a changelog on `main` to grow (a new `include`, a new
changeset appended) and blocks only changes to existing lines. G2 applies to gate files
that are committed; a `CodeRulesTest` the agent just created can still be fixed.

Why exit 2 and not a hint: in GigaCode, `additionalContext` from PreToolUse never reaches
the model, while an exit-2 refusal does (hook probe on GigaCode 26.11.141).

## After a write (PostToolUse)

New soft findings of that edit (W1–W12) and, the first time a role appears in the
session, 3–5 rules for that role go back as `additionalContext` appended to the tool
result — the freshest place in the model's context.

## Prompts and compaction

- GigaCode: every prompt with text gets a ≤ 60-token anchor (passport + three rules).
  GigaCode does not de-duplicate it, so it stays short.
- After `PostCompact` (GigaCode) or `SessionStart` with `source: compact` (Claude), the next
  prompt gets a ≤ 400-token recovery block once.

## End of turn (Stop)

- Once per session at `context_usage ≥ 0.70`, the model is asked to write a handoff note
  (`grillspec note handoff` when grillspec is installed, otherwise at the top of its plan
  file). Only GigaCode sends `context_usage`; in Claude Code this warning never fires.
- If the session changed `.java` files since the last successful check, the hook runs
  `mvnw -q -o compile` (or `mvn`) for the affected modules (180 s timeout). It blocks only
  on errors in files the session changed, at most twice per change set; anything it cannot
  verify (offline cache, no Maven) becomes a system message.

## Rules

| Hard (block) | Soft (remark) |
|---|---|
| J1 field `@Autowired` (production code) | W1 `@Data` / `@EqualsAndHashCode` / `@ToString` on `@Entity` |
| J2 `javax.*` on Boot 3+ | W2 `@ManyToOne` / `@OneToOne` without LAZY |
| J3 `System.out` / `printStackTrace` in `src/main` | W3 `@Enumerated` without STRING |
| J4 `@MockBean` / `@SpyBean` on Boot 4 | W4 `@Transactional` on private / final |
| J5 JUnit 4 | W5 empty `catch` |
| J6 new `@Disabled` in tests | W6 `@SneakyThrows` |
| G1 edit of an applied changeset | W7 concatenation in log calls |
| G2 edit of gate configs | W8 `*Impl` class |
| S1 `push --force`, `reset --hard`, `clean -f` | W9 repository in a controller |
| S2 gates with `-DskipTests` and similar | W10 MapStruct mapper without `unmappedTargetPolicy = ERROR` |
| | W11 `Optional` field / parameter |
| | W12 `@Data` DTO class where a record fits |

Rules are line-based regexes over the code with comments and string literals blanked
out; anything that needs types lives in the ArchUnit gate (`java-quality-gates`).
