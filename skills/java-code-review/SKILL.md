---
name: java-code-review
description: Systematic review of Java / Spring Boot code - correctness, null and exception handling, concurrency, performance and JPA queries, security, REST API contract, tests and the team's conventions. Use when asked to review code, a diff, a class or a pull request, before committing or merging, or as the checklist when a mentor reviews the developer's code.
---

# Java code review

## Workflow

1. Scope: the diff (`git diff`, the PR) plus the code it calls and the code that calls it.
   Read the tests that cover it.
2. Understand the intent: ticket, spec, commit message. Review against intent, not taste.
3. Go through the areas below; open a reference only for the areas the change touches.
4. For each finding, prove it when you can: a failing test, a concrete input, a line
   that shows the path. A finding you cannot make concrete is a question, not a defect.
5. Report in the format below, most severe first.

| Area | Reference | Look at it when the change has |
|---|---|---|
| Correctness | [correctness](references/correctness.md) | any logic, null handling, exceptions, equality, time, money |
| Concurrency | [concurrency](references/concurrency.md) | shared state, `@Async`, executors, caches, scheduled jobs |
| Performance | [performance](references/performance.md) | queries, loops over data, collections, I/O in loops |
| Security | [security](references/security.md) | input handling, queries, auth, logging, files, external calls |
| API contract | [api-contract](references/api-contract.md) | controllers, DTOs, status codes, versioning |
| Tests | [tests](references/tests.md) | new behaviour or changed tests |

Conventions (layers, Lombok, DTO records, `*Impl`, MapStruct policy, Liquibase) come from
`java-conventions`; the hooks already block hard violations, so focus on what they cannot
see: design, logic and missing cases.

## Finding format

```
[severity] path/File.java:line — what is wrong
  Why: the concrete failure (input → wrong result / crash / leak)
  Fix: the smallest change that removes it
```

Severity:
- **critical** — data loss, security hole, production outage, wrong money;
- **important** — a bug users will hit, a missing case, a broken contract;
- **minor** — maintainability, naming, a clearer way to write it.

End with what the change does well (one line) and a verdict: *ready*, *ready after
fixes*, or *needs rework*.

## Rules

- Review the code that exists, not a rewrite you would prefer. No rewrite proposals for
  untouched legacy code.
- Every finding names a file and line and a concrete consequence.
- Do not report what the compiler, the hooks or the ArchUnit gate already enforce unless
  they were bypassed.
- Tests are part of the change: missing negative cases are an **important** finding.
- When reviewing a learner's code, explain the *why* of each finding in one sentence and
  point to the reference, but let them write the fix.
