---
name: java-verification
description: Prove a Java / Maven change works before saying so. Use before any claim that code compiles, tests pass, a bug or flaky test is fixed, or a change is ready to commit or merge - pick the right mvn / mvnw command, run it, read Surefire and Failsafe summaries, and end the message with a Verification block quoting the output.
---

# Verification before "done"

A claim about a build is worth exactly the build output behind it. Weak spots: a pipe
that hides the exit code, a goal that skips integration tests, zero tests run at exit 0.

## Which command

| Claim | Command |
|---|---|
| "It compiles" | `./mvnw -q compile` (or `mvn`; `-o` offline when the cache is warm) |
| "Unit tests pass" | `./mvnw test` |
| "Ready to merge" / "all checks pass" | `./mvnw verify` — runs Failsafe `*IT`, ArchUnit, Enforcer, JaCoCo report |
| One test while iterating | `./mvnw test -Dtest=OrderServiceTest` (then the full suite before the claim) |
| One module of a multi-module build | `./mvnw -pl core -am verify` |

Use the wrapper when the project has one; on Windows `mvnw.cmd`.

## Getting the evidence

```bash
log="${TMPDIR:-/tmp}/forbxpg-java-build-$$.log"
./mvnw -B verify > "$log" 2>&1; echo "exit=$?"
```

Keep the log outside the project (it must not end up in a commit). Use that same `$log`
for every read of this run: a fixed `build.log` is shared by every session in the temp
directory, and a second build truncates the first. Then read, from it:

- `Tests run: N, Failures: F, Errors: E, Skipped: S` — one summary for Surefire, one for
  Failsafe when `*IT` tests exist;
- `BUILD SUCCESS` / `BUILD FAILURE`;
- the first `[ERROR]` lines when it failed.

On Windows (`cmd`): `set "LOG=%TEMP%\forbxpg-java-build-%RANDOM%.log"`, then
`mvnw.cmd -B verify > "%LOG%" 2>&1` and `echo exit=%ERRORLEVEL%`, and read it with
`findstr /C:"Tests run" /C:"BUILD" "%LOG%"`. Keep the same `LOG` for the read.

## The Verification block

End every message that reports a build, test or fix result with:

```markdown
**Verification**
- Command: `./mvnw -B verify` (exit 0)
- Unit tests (Surefire): Tests run: 42, Failures: 0, Errors: 0, Skipped: 0
- Integration tests (Failsafe): Tests run: 6, Failures: 0, Errors: 0, Skipped: 0
- Result: BUILD SUCCESS
```

- Every line is copied from output you got **in this session**. No output → `not run`, and
  no claim that depends on it.
- Counts come from Maven's summary, never from counting `@Test` methods.
- The exit code is Maven's own, not that of a `grep` or `tail` it was piped into.

## MUST NOT

- Skip checks to get green: `-DskipTests`, `-Dmaven.test.skip`, `-Djacoco.skip`,
  `-Dcheckstyle.skip`, `-Denforcer.skip` on `test` / `verify` / `install` (the hook blocks
  it). Packaging a jar with `-DskipTests` to run it is fine.
- Report "tests pass" when `Tests run: 0` — find out why no tests ran.
- Treat `Skipped: S > 0` as passing without saying which tests were skipped and why.
- Call a flaky test fixed after one green run: run it at least 5 times
  (`-Dsurefire.rerunFailingTestsCount=0`, repeated) and report before / after counts.
- Delete, weaken or `@Disabled` a test to make the build pass.

## When the build cannot run here

Offline cache missing an artifact, no Docker for Testcontainers, no network to the
mirror: say exactly which check did not run and why, mark it `not run` in the block,
and do not claim what it would have proved.
