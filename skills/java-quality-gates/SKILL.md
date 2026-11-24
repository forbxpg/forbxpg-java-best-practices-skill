---
name: java-quality-gates
description: Set up build-time quality gates in a Maven / Spring Boot project - the ArchUnit CodeRulesTest with the team's rules, a FreezingArchRule baseline for legacy code, Maven Enforcer for Java and Maven versions, and a JaCoCo report. Use when asked to add ArchUnit, architecture tests, code rules, quality gates or build checks, or to make the build fail on the mistakes agents make.
---

# Quality gates

Hooks advise and block single writes; gates make `mvn verify` fail for everyone, every
time, in CI too. Rules that matter belong in the build.

**Ask the user before changing the build.** Show the exact files and pom changes first.
In a corporate network, dependencies often come only from an internal mirror: use versions the
team's other projects already use (ArchUnit 1.5.x, JaCoCo 0.8.13+, Enforcer 3.x).

## Workflow

1. Check what the project already has (passport `quality: [...]`, the pom). Extend it;
   do not add a second tool for the same job.
2. Add the ArchUnit dependency (test scope) if missing.
3. Copy [CodeRulesTest](assets/CodeRulesTest.java) into the base package under
   `src/test/java`, fix the `package` line. Rules: [archunit-rules](references/archunit-rules.md).
4. Run `./mvnw -q test -Dtest=CodeRulesTest`.
   - New project: fix every violation.
   - Existing code with violations: freeze them ([legacy-baseline](references/legacy-baseline.md)),
     so new code is checked and old code does not block.
5. Add Enforcer (Java version range, Maven version, dependency convergence) if missing.
6. Add the JaCoCo report; add a coverage **threshold only if the user asks** for one.
7. Run `./mvnw verify` and report with the Verification block (`java-verification`).

## Maven snippets

```xml
<dependency>
    <groupId>com.tngtech.archunit</groupId>
    <artifactId>archunit-junit5</artifactId>
    <version>${archunit.version}</version>
    <scope>test</scope>
</dependency>
```

```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-enforcer-plugin</artifactId>
    <executions>
        <execution>
            <id>enforce</id>
            <goals><goal>enforce</goal></goals>
            <configuration>
                <rules>
                    <requireJavaVersion><version>[21,)</version></requireJavaVersion>
                    <requireMavenVersion><version>[3.9,)</version></requireMavenVersion>
                    <dependencyConvergence/>
                </rules>
            </configuration>
        </execution>
    </executions>
</plugin>
```

```xml
<plugin>
    <groupId>org.jacoco</groupId>
    <artifactId>jacoco-maven-plugin</artifactId>
    <executions>
        <execution><goals><goal>prepare-agent</goal></goals></execution>
        <execution><id>report</id><phase>verify</phase><goals><goal>report</goal></goals></execution>
    </executions>
</plugin>
```

## MUST NOT

- Weaken a rule, add to the freeze store, or add exclusions to get a change through — the
  hooks block edits to `CodeRulesTest`, `archunit_store/` and `archunit.properties`. Fix
  the code, or ask the user to change the rule.
- Impose a formatter (Spotless, palantir, google-java-format) on a project that has none;
  propose it as a separate change.
- Add a coverage threshold the team did not choose.

## Gotchas

- `dependencyConvergence` often fails on existing projects: report the conflicts and ask
  before adding exclusions.
- ArchUnit sees bytecode: Lombok annotations (`@Data`) are invisible to it; the hooks cover
  those.
- Generated sources (MapStruct implementations) are analysed too; rules here do not
  conflict with them, custom rules might.
