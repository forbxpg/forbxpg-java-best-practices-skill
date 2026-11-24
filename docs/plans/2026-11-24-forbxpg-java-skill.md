# 2026-11-24-forbxpg-java-skill — plan

## Goal

Build `forbxpg-java`: nine Agent Skills for Java / Spring Boot and Node hooks that block
hard-rule violations before a write and report soft ones after it, installable in Claude
Code, GigaCode and Codex.

## Architecture

One Node entry point `hooks/java-hooks.mjs <Event> --harness <h>` dispatches to pure
handler functions in `hooks/lib/`. Each handler takes `(input, ctx)` and returns
`{ exitCode, stdout, stderr }`, so tests run without a harness. Rules are line-based
regex checks over the whole resulting file text. "New" violations are the result's
violations minus the original's. Skills are plain `SKILL.md` + `references/` checked by
Node scripts for spec compliance and token budget.

**Spec:** docs/specs/2026-11-24-forbxpg-java-skill.md

## Global Constraints

- Node ≥ 20, no npm dependencies, only `node:` built-ins. No bash, PowerShell or Python
  anywhere in the product or the tests.
- Tests: `node --test tests/`; every test creates its fixtures under `os.tmpdir()`.
- Every hook message starts with `[forbxpg-java]` and has the shape
  `<ID>: <what>. Fix: <how>. Example: <one line>`.
- Hooks never write inside the project; state lives under
  `<os.tmpdir()>/forbxpg-java/<sha1(projectDir) first 12 hex>/<session_id>/`.
- Any internal hook error → exit 0, no output, one line appended to `hook.log` in the
  state dir (fail open).
- Skills are in English; `name` matches `^[\p{L}\p{N}_:.-]+$`; `SKILL.md` ≤ 150 lines;
  a reference ≤ 250 lines.
- Token budgets (estimate = characters / 4): router ≤ 1 500, anchor ≤ 60,
  post-compaction block ≤ 400, one role's rules ≤ 120.
- The repository is not a git repository yet: run `git init` before 2.2 (G1 tests
  create their own temporary repositories). Commits are the user's call: no step
  commits.

## Review Focus

1. Windows CRLF files: `old_string` with `\n` must still match a CRLF file, and
   violations must report correct line numbers → 2.2 pins it with a CRLF fixture.
2. An `edit` whose `old_string` is not in the file (the tool itself will fail) must not
   block → 2.2 pins: result = original text, exit 0.
3. Patterns inside comments and string literals (`// System.out`, `"@Autowired"`) must
   not trigger J-rules → 2.1 pins it.
4. On Windows `mvn` / `mvnw` are `.cmd` files and need a shell to spawn → 3.2 pins the
   command built for `process.platform === 'win32'`.
5. R-HOOK-6 speed: a 2 000-line file through `findViolations` twice (before and after)
   must take < 300 ms → 2.1 pins it with a timing test.

## 1. Hook foundation

- [x] 1.1 Input, routing, state and config — verify: node --test tests/io.test.mjs tests/entry.test.mjs passes

Covers: S-HOOK-2a · Test: scenario-first
Reqs: R-HOOK-1, R-HOOK-2, R-HOOK-3, R-HOOK-4, R-HOOK-5; spec 5.9

Files: create hooks/java-hooks.mjs, hooks/lib/io.mjs, hooks/lib/state.mjs,
hooks/lib/config.mjs; test tests/io.test.mjs, tests/entry.test.mjs,
tests/fixtures/inputs/{claude,gigacode,codex}-{write,edit,shell}.json

Interfaces:
- Produces: `projectDir(input, env) -> string` — first non-empty of
  `CLAUDE_PROJECT_DIR`, `GIGACODE_PROJECT_DIR`, `QWEN_PROJECT_DIR`, `input.cwd`.
- Produces: `isMavenProject(dir) -> boolean` (`pom.xml` exists in `dir`).
- Produces: `normalizeTool(input) -> { kind: 'write'|'edit'|'shell'|'other', filePath?,
  content?, oldString?, newString?, replaceAll?, command? }`. Tool names: write —
  `write_file`, `Write`; edit — `edit`, `replace`, `Edit`, `MultiEdit` (first edit only);
  shell — `run_shell_command`, `Bash`, `shell`; `apply_patch` → `kind: 'other'` in v1.
  Fields read tolerantly: `file_path|path|absolute_path`, `content`,
  `old_string|oldString`, `new_string|newString`, `replace_all`.
- Produces: `sessionDir(projectDir, sessionId) -> string`; `readState(dir, key, fallback)`,
  `writeState(dir, key, value)` (one JSON file per key); `logError(dir, err)`.
- Produces: `loadConfig(projectDir, homeDir) -> { anchor: boolean|null, stopCompile:
  boolean, contextWarnAt: number }` — project `forbxpg-java.json` over
  `~/.forbxpg-java.json` over defaults `{ anchor: null, stopCompile: true,
  contextWarnAt: 0.7 }`.
- Produces: `main(argv, stdin, env) -> Promise<{ exitCode, stdout, stderr }>` in
  `java-hooks.mjs`, dispatching by event to handlers registered in later tasks; unknown
  event → exit 0, empty output.

1. Save one stdin sample per harness and tool kind into `tests/fixtures/inputs/`
   (GigaCode shapes from the probe: `tool_name`, `tool_input`, `tool_use_id`, `cwd`,
   `session_id`; Claude: `Write`/`Edit`/`Bash` with `file_path`, `content`, `old_string`,
   `new_string`, `command`).
2. Write tests: `projectDir` precedence (all three env vars set → `CLAUDE_PROJECT_DIR`);
   `normalizeTool` for each fixture; `loadConfig` precedence; `main` with a directory
   without `pom.xml` → `{ exitCode: 0, stdout: '' }` (S-HOOK-2a); `main` with stdin
   `not json` → exit 0 and a line in `hook.log`. Run. Expected: FAIL (module not found).
3. Implement the four modules and `main`; the file's bottom runs `main` when executed
   directly and writes the result to the process streams.
4. Run `node --test tests/io.test.mjs tests/entry.test.mjs`. Expected: PASS.

- [x] 1.2 Project passport — verify: node --test tests/passport.test.mjs passes

Covers: S-PASS-1, S-PASS-2 · Test: scenario-first

Files: create hooks/lib/passport.mjs; test tests/passport.test.mjs,
tests/fixtures/poms/{boot4-lombok-mapstruct-liquibase,boot3-multimodule,quarkus,plain}/

Interfaces:
- Produces: `readPassport(projectDir) -> Passport` with fields `build: 'maven'`,
  `wrapper: boolean`, `java: string|null`, `boot: string|null`, `lombok`, `mapstruct`,
  `mapstructBinding`, `liquibase`, `flyway`, `h2`, `testcontainers` (booleans),
  `web: string[]` (`webmvc`, `webflux`, `feign`), `quality: string[]` (`checkstyle`,
  `spotbugs`, `spotless`, `errorprone`, `archunit`, `jacoco`, `enforcer`),
  `modules: string[]`, `docker: boolean`, `framework: 'spring'|'quarkus'|'jakarta'|'plain'`.
  Cached in `<os.tmpdir()>/forbxpg-java/<hash>/passport.json` keyed by the root
  `pom.xml` mtime.
- Produces: `passportLine(p) -> string`; `bootMajor(p) -> number|null`.

1. Fixture poms: Boot 4 = parent `spring-boot-starter-parent` 4.1.1,
   `maven.compiler.release` 21, Lombok, MapStruct + `lombok-mapstruct-binding`,
   `liquibase-core`; Boot 3 multi-module = parent 3.5.0, `java.version` 17, modules
   `core`, `app`; Quarkus = `io.quarkus.platform:quarkus-bom`; plain = no parent.
2. Write tests: S-PASS-1 → `passportLine` equals
   `Maven · Java 21 · Boot 4.1 · Lombok · MapStruct · Liquibase`; S-PASS-2 →
   `framework === 'quarkus'` and the line ends with `Quarkus: no specific rules`;
   multi-module → `modules` equals `['core', 'app']` and Java is read from the parent;
   cache reuse when mtime is unchanged. Run. Expected: FAIL.
3. Implement with regexes over the pom text; module poms are read for dependencies
   only. Docker = `fs.existsSync('\\\\.\\pipe\\docker_engine')` on win32, else
   `/var/run/docker.sock`.
4. Run the tests. Expected: PASS.

## 2. Rules and tool hooks

- [x] 2.1 Rule engine (J1–J6, W1–W12) — verify: node --test tests/rules.test.mjs passes

Covers: — · Test: scenario-first
Reqs: spec 5.3 Java table, 5.4 table, R-HOOK-6

Files: create hooks/lib/rules.mjs, hooks/lib/javatext.mjs; test tests/rules.test.mjs

Interfaces:
- Produces: `findViolations(text, { path, passport }) -> Violation[]`,
  `Violation = { id, severity: 'hard'|'soft', line, message }`.
- Produces: `newViolations(before, after) -> Violation[]` — per rule id, the after-lines
  whose trimmed text is not among the before-lines of the same id (a multiset).
- Produces: `formatViolation(v) -> string` in the global message shape, with fixed
  `Fix` / `Example` text per rule id.
- Produces in `javatext.mjs`: `stripCommentsAndStrings(text) -> string` that keeps line
  count (replaces content with spaces).

1. Write a "catches" test and a "does not catch" test for every id. Conditions from the
   spec: J2 only when `bootMajor >= 3`; J3 only under `src/main/`; J4 only when
   `bootMajor >= 4`; J6 only under `src/test/`; W1 needs `@Entity` in the same file; W10
   only when `passport.mapstruct`. Not-catch cases include the patterns inside `//`,
   `/* */` and string literals (Review Focus 3). Timing test: a generated 2 000-line
   file, `findViolations` twice + `newViolations` < 300 ms (Review Focus 5). Run.
   Expected: FAIL.
2. Implement `stripCommentsAndStrings`, then each rule as a regex over the stripped
   lines, except W1, W4 and W9, which look at the annotations block preceding a class
   or method declaration.
3. Run the tests. Expected: PASS.

- [x] 2.2 PreToolUse: hard rules, protected files, shell guard — verify: node --test tests/pre.test.mjs passes

Covers: S-PRE-2a, S-PRE-2b, S-PRE-G1, S-PRE-S2 · Test: scenario-first
Reqs: R-PRE-1, R-PRE-2; spec 5.3 G1, G2, S1, S2

Files: create hooks/lib/pre.mjs, hooks/lib/guard.mjs, hooks/lib/edit.mjs; modify
hooks/java-hooks.mjs (register `PreToolUse`); test tests/pre.test.mjs

Interfaces:
- Consumes: `normalizeTool` (1.1), `readPassport` (1.2), `findViolations`,
  `newViolations`, `formatViolation` (2.1), `writeState` (1.1).
- Produces: `applyEdit(original, oldString, newString, replaceAll) -> string` —
  CRLF-tolerant: when `oldString` is absent but its `\r\n` form is present, replace that;
  when neither is present, return `original`.
- Produces: `checkShell(command) -> Violation|null` (S1, S2);
  `checkProtectedPath(absPath, projectDir) -> Violation|null` (G1 via
  `git -C <projectDir> cat-file -e <ref>:<rel>` for `origin/main`, `origin/master`,
  `main`, `master`; G2 glob list from spec 5.3).
- Produces: `handlePreToolUse(input, ctx) -> { exitCode, stdout, stderr }`; blocked →
  exit 2, stderr = formatted violations joined by `\n`. Side effect: saves the before-
  violations of a `.java` write as state key `pre-<tool_use_id or sha1(path)>`.

1. Write tests:
   - S-PRE-2a: file with an existing `@Autowired private Foo foo;`, edit changes another
     method → exit 0.
   - S-PRE-2b: edit adds `@Autowired private Foo foo;` → exit 2, stderr contains `J1` and
     `@RequiredArgsConstructor`.
   - S-PRE-G1: temp git repo, changelog committed on `main`, edit of that file → exit 2,
     stderr contains `create a new changeset file`; a new changelog file → exit 0.
   - S-PRE-S2: `mvn -q package -DskipTests` → exit 0; `./mvnw verify -DskipTests` → exit
     2; `git push -f origin x` → exit 2.
   - G2: write to `src/test/java/x/CodeRulesTest.java` that already exists → exit 2.
   - CRLF file + LF `old_string` (Review Focus 1); missing `old_string` → exit 0 (Review
     Focus 2).
   Run. Expected: FAIL.
2. Implement `edit.mjs`, `guard.mjs` and `pre.mjs`; register the handler.
3. Run the tests. Expected: PASS.

- [x] 2.3 PostToolUse: soft findings and role rules — verify: node --test tests/post.test.mjs passes

Covers: S-POST-2a · Test: scenario-first
Reqs: R-POST-1, R-POST-2

Files: create hooks/lib/post.mjs, hooks/lib/roles.mjs; modify hooks/java-hooks.mjs
(register `PostToolUse`); test tests/post.test.mjs

Interfaces:
- Consumes: state key `pre-<id>` (2.2), `findViolations`, `newViolations` (2.1).
- Produces: `detectRole(path, text) -> 'controller'|'service'|'repository'|'entity'|
  'dto'|'mapper'|'config'|'exception-handler'|'test'|'liquibase'|null`;
  `ROLE_RULES: Record<role, string>` (3–5 bullet lines each; content from the matching
  skill, written in 5.2–5.5).
- Produces: `handlePostToolUse(input, ctx)` → when there is something to say, stdout =
  `{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"..."}}`.
  Without a `pre-<id>` snapshot, soft findings are skipped (only role rules). Appends
  the file to state key `changedFiles`.

1. Write tests: a write adding `@Data` to an `@Entity` → context contains `W1`; first
   `FooController.java` → context contains the controller rules; S-POST-2a: a second
   `BarController.java` in the same session → no controller rules; a clean write of an
   already seen role → empty stdout; every `ROLE_RULES` entry ≤ 120 tokens. Run.
   Expected: FAIL.
2. Implement; role order: path (`src/test/` → test, `db/changelog/` → liquibase), then
   annotations, then name suffix.
3. Run the tests. Expected: PASS.

## 3. Session hooks

- [x] 3.1 SessionStart, UserPromptSubmit anchor, PostCompact flag — verify: node --test tests/session.test.mjs passes

Covers: — · Test: scenario-first
Reqs: R-ANCHOR-1, R-ANCHOR-2, R-ANCHOR-3; spec 5.8

Files: create hooks/lib/session.mjs, hooks/lib/anchor-text.mjs; modify
hooks/java-hooks.mjs (register `SessionStart`, `UserPromptSubmit`, `PostCompact`);
test tests/session.test.mjs

Interfaces:
- Consumes: `readPassport`, `passportLine` (1.2), `loadConfig` (1.1).
- Produces: `anchorText(passport) -> string` (passport line + three rules: load
  `java-conventions` before new classes; no `@Data` on `@Entity`; run `./mvnw -q compile`
  before saying done) and `recoveryText(passport) -> string` (passport, the router's
  top rules, `Re-read your plan and grillspec notes.`).
- Produces: handlers. `SessionStart` → stdout = passport line (plain text); with
  `source: 'compact'` also sets flag `compacted`. `PostCompact` → sets flag
  `compacted`, no output. `UserPromptSubmit` → if `compacted`: `recoveryText` once and
  clear the flag; else `anchorText` when `config.anchor ?? (harness === 'gigacode')`.
  Output as `hookSpecificOutput.additionalContext`.

1. Write tests: gigacode → anchor on every prompt; claude → no anchor by default, anchor
   when `forbxpg-java.json` has `anchor: true`; after `PostCompact` the next prompt gets
   `recoveryText` exactly once, then the anchor again; `anchorText` ≤ 60 tokens;
   `recoveryText` ≤ 400 tokens. Run. Expected: FAIL.
2. Implement.
3. Run the tests. Expected: PASS.

- [x] 3.2 Stop: context warning and compile check — verify: node --test tests/stop.test.mjs passes

Covers: S-STOP-2a · Test: scenario-first
Reqs: R-STOP-1, R-STOP-2

Files: create hooks/lib/stop.mjs, hooks/lib/maven.mjs; modify hooks/java-hooks.mjs
(register `Stop`); test tests/stop.test.mjs

Interfaces:
- Consumes: state `changedFiles` (2.3), `loadConfig` (1.1).
- Produces: `mavenCommand(projectDir, moduleRel, platform) -> { cmd, args, shell }` —
  `mvnw.cmd` / `mvnw` when present, else `mvn`; args `-q -o compile`, plus
  `-pl <moduleRel> -am` when the module is not the root; `shell: platform === 'win32'`.
- Produces: `parseCompileErrors(output) -> { file, line, message }[]` from
  `[ERROR] <path>.java:[<line>,<col>] <message>`.
- Produces: `handleStop(input, ctx, runCompile)`;
  `runCompile(command, timeoutMs) -> Promise<{ ok, output, timedOut }>`, injected (the
  real one uses `child_process.spawn`, 180 000 ms).

1. Write tests with a fake `runCompile`:
   - `context_usage: 0.72`, not yet warned → stdout `{"decision":"block","reason":…}`
     mentioning `grillspec note handoff`; second Stop → no warning; `stop_hook_active:
     true` → never blocks.
   - Changed `Foo.java`, compile error in `Foo.java` → block; S-STOP-2a: error only in
     `Other.java` → no block, `systemMessage` says the change could not be verified.
   - Third Stop on the same change set after two blocks → `systemMessage`, no block.
   - Same fingerprint after a successful compile → `runCompile` not called.
   - `stopCompile: false` → `runCompile` not called.
   - `mavenCommand` on `win32` with `mvnw.cmd` → `{ cmd: 'mvnw.cmd', shell: true }`
     (Review Focus 4).
   Run. Expected: FAIL.
2. Implement. Fingerprint = sha1 of sorted `path:mtimeMs` of `changedFiles`. Module of
   a file = its nearest ancestor with `pom.xml`. Output mentioning offline mode or a
   missing artifact → `systemMessage`, never a block.
3. Run the tests. Expected: PASS.
4. Manual check on a real project with a cached `~/.m2`: break a file, end a turn,
   confirm the block. Expected: block names that file.

## 4. Repository tooling and packaging

- [x] 4.1 Skill validator, token check and routing eval — verify: node --test tests/scripts.test.mjs passes

Covers: — · Test: scenario-first
Reqs: R-SKILL-1, R-REPO-1, R-REPO-2

Files: create scripts/validate-skills.mjs, scripts/check-tokens.mjs,
scripts/eval-routing.mjs, evals/routing.tsv (header only); test
tests/scripts.test.mjs, tests/fixtures/skills/{good,bad-name,too-long,no-evals}/

Interfaces:
- Produces: `validateSkills(skillsDir, evalsFile) -> { errors: string[], warnings:
  string[] }` — frontmatter fields `name`, `description` (≤ 1024), optional `license`,
  `compatibility`, `metadata`, `allowed-tools`; name regex; folder name = `name`; line
  limits; every `references/*.md` linked from `SKILL.md` exists; ≥ 2 routing cases per
  skill. CLI exits 1 on errors.
- Produces: `checkTokens(repoDir) -> { item, tokens, limit }[]` over the router
  `SKILL.md`, `anchorText`, `recoveryText`, each `ROLE_RULES` entry. CLI exits 1 when
  over.
- Produces: `eval-routing.mjs --endpoint <url> --model <id>` (key from `ROUTING_API_KEY`)
  — sends each prompt with the list of skill names + descriptions, prints a confusion
  table; not part of `node --test`.

1. Write tests on the fixture skills: `good` passes; `bad-name` → error naming the
   regex; `too-long` → error with the line count; `no-evals` → error naming R-SKILL-1.
   Run. Expected: FAIL.
2. Implement the three scripts.
3. Run the tests. Expected: PASS.

- [x] 4.2 Manifests for Claude Code, GigaCode and Codex — verify: node --test tests/manifests.test.mjs passes

Covers: — · Test: scenario-first
Reqs: spec section 6

Files: create gigacode-extension.json, .claude-plugin/plugin.json, hooks/hooks.json,
.codex-plugin/plugin.json, hooks/hooks-codex.json; test tests/manifests.test.mjs

Interfaces:
- Consumes: event names registered in 1.1–3.2.
- Produces: GigaCode manifest `name: "forbxpg-java"`, `contextFileName:
  ["skills/using-java-best-practices/SKILL.md"]`, `hooks` (format proven by the probe):
  `PreToolUse` and `PostToolUse` with matcher `^(write_file|edit|replace|run_shell_command)$`,
  `SessionStart`, `UserPromptSubmit`, `PostCompact`, `Stop`; command
  `node "${extensionPath}${/}hooks${/}java-hooks.mjs" <Event> --harness gigacode`,
  timeout in milliseconds: 10 000, Stop 200 000. Claude: same events, matcher
  `Write|Edit|MultiEdit|Bash`, `${CLAUDE_PLUGIN_ROOT}`, `--harness claude`, SessionStart
  instead of PostCompact for compaction, timeout in **seconds**: 10, Stop 200. Codex:
  `--harness codex`.

1. Write tests: each manifest parses; every command names an existing file and a
   registered event; GigaCode has no hook on an event the probe did not confirm; the
   GigaCode `contextFileName` exists. Run. Expected: FAIL.
2. Write the manifests.
3. Run the tests. Expected: PASS.
4. Manual: `claude --plugin-dir .` in a fixture project; a write with `@Autowired` field
   is refused. In GigaCode: `echo Y| gigacode extensions link <path>`, same
   check. Expected: the refusal reaches the model in both.

## 5. Skills

Sources to adapt (attribution in NOTICE, 6.1): decebals/claude-code-java (MIT),
piomin/claude-ai-spring-boot (Apache-2.0), a-pavithraa/springboot-skills-marketplace
(MIT), Jeffallan/claude-skills (MIT), rrezartprebreza/spring-boot-skills (MIT),
Marisha-Sahay/awesome-java-agent-skills (MIT). Team facts: spec section 4 table and
decision log items 10–20. Each task adds two routing cases per skill to
`evals/routing.tsv` and fills the `ROLE_RULES` entries the skill owns.

- [x] 5.1 Router and java-conventions — verify: node scripts/validate-skills.mjs && node scripts/check-tokens.mjs exit 0

Covers: — · Test: none: prose; structure and budget are checked by 4.1's scripts

Files: create skills/using-java-best-practices/SKILL.md,
skills/java-conventions/SKILL.md, skills/java-conventions/references/{lombok,packages-and-naming,dto-and-mapping,configuration}.md;
modify hooks/lib/roles.mjs (dto, mapper, config), evals/routing.tsv

1. Router: passport usage, ~12 top rules (spec section 4 row 1), a "which skill when"
   table for the other eight, the small-steps rule and the Verification block pointer.
   ≤ 1 500 tokens.
2. `java-conventions` per spec section 4 row 2; `lombok.md` holds the per-role table
   (entity: `@Getter @Setter @NoArgsConstructor(access = PROTECTED)`, `@Builder`
   allowed, manual `equals` / `hashCode` by id; never `@Data` / `@EqualsAndHashCode` /
   `@ToString`; services: `@RequiredArgsConstructor`, `@Slf4j`; no `@SneakyThrows`).
3. Run both scripts. Expected: exit 0.

- [x] 5.2 java-language and spring-boot-service — verify: node scripts/validate-skills.mjs && node scripts/check-tokens.mjs exit 0

Covers: — · Test: none: prose; checked by 4.1's scripts

Files: create skills/java-language/** and skills/spring-boot-service/** per spec section
4 rows 3–4; modify hooks/lib/roles.mjs (controller, service, exception-handler),
evals/routing.tsv

1. Write both skills with the references listed in the spec. `boot3-differences.md`
   lists the Boot 3 ↔ 4 differences the hooks rely on (`@MockBean` removed, Jackson 3,
   starter renames). `java25.md` lists what needs 25 and what needs `--enable-preview`
   on 21.
2. Run both scripts. Expected: exit 0.

- [x] 5.3 spring-data-jpa and java-testing — verify: node scripts/validate-skills.mjs && node scripts/check-tokens.mjs exit 0

Covers: — · Test: none: prose; checked by 4.1's scripts

Files: create skills/spring-data-jpa/** and skills/java-testing/** per spec section 4
rows 5–6; modify hooks/lib/roles.mjs (entity, repository, test, liquibase),
evals/routing.tsv

1. `liquibase.md`: never edit an applied changeset, one new file per change, naming,
   rollback. `slices-and-h2.md` states that H2 does not catch Postgres / Greenplum
   dialect differences. `testcontainers.md` applies only when the passport shows
   Docker.
2. Run both scripts. Expected: exit 0.

- [x] 5.4 java-code-review, java-verification, java-quality-gates — verify: node scripts/validate-skills.mjs exits 0 and mvn -q test in tests/fixtures/gates-project fails on exactly the planted rules

Covers: — · Test: scenario-first
Reqs: spec 5.5

Files: create skills/java-code-review/**, skills/java-verification/SKILL.md,
skills/java-quality-gates/** including assets/CodeRulesTest.java; test
tests/fixtures/gates-project/ (Maven, Boot 4, one class per planted violation),
evals/routing.tsv

1. Plant one violation per ArchUnit rule from spec 5.5 in `gates-project`. Copy
   `CodeRulesTest.java` in. Run `mvn -q test`. Expected: FAIL listing every planted rule
   and nothing else.
2. Fix nothing in the fixture; adjust only the rules until step 1's expectation holds;
   add a `FreezingArchRule` variant and check that a second run with the store passes.
3. Write the three skills; `java-verification` carries the Verification block with
   Surefire / Failsafe summary lines and "0 tests at exit 0 is not a pass".
4. Run `node scripts/validate-skills.mjs`. Expected: exit 0.

## 6. Release

- [ ] 6.1 Docs, NOTICE, CI — verify: GitHub Actions run is green on windows-latest, ubuntu-latest, macos-latest for Node 20 and 22

Covers: — · Test: none: docs and CI config; CI runs the existing tests
Reqs: R-REPO-3, R-REPO-4

Files: create README.md, README.ru.md, docs/{en,ru}/{installation,how-it-works,configuration}.md,
NOTICE, LICENSE, CHANGELOG.md, .github/workflows/test.yml

1. Installation section per spec section 6, including `link` (not `install`) and the
   `echo Y|` form for non-interactive GigaCode.
2. NOTICE lists the six sources with license and what was adapted.
3. Workflow: matrix OS × Node; steps `node --test tests/`,
   `node scripts/validate-skills.mjs`, `node scripts/check-tokens.mjs`.
4. Push to a branch and check the run. Expected: all green.
