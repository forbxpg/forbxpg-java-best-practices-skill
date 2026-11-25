---
description: Review the current Java/Spring diff against the forbxpg-java rules
---

Review the uncommitted changes of this repository with the forbxpg-java rules.

1. Load the `java-code-review` skill and follow it.
2. Run `git diff` and `git diff --staged` to see the changes. If both are empty, say so and
   stop.
3. Check every changed Java, pom.xml and changelog file against the skill: correctness,
   transactions, JPA fetching and N+1, exceptions, REST contract, security, tests, and the
   project's rules (Lombok, MapStruct, layering, Liquibase).
4. Report findings as `file:line — problem — fix`, most severe first. Say which findings you
   verified by reading the code around them. Do not change files unless the user asks.
