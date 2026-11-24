# Freezing existing violations

An existing project usually breaks several rules on day one. Freezing records today's
violations so the build passes, while every **new** violation still fails.

## Steps

Do this while `CodeRulesTest` and `archunit.properties` are still new (not committed): the
hooks block agent edits to committed gate files (G2). If they are committed already, ask the
user to apply the changes below.

1. Wrap each rule in `FreezingArchRule.freeze(...)`:

```java
import com.tngtech.archunit.library.freeze.FreezingArchRule;

@ArchTest
static final ArchRule j3_no_standard_streams = FreezingArchRule.freeze(noClasses()
        .that(not(IN_TESTS))
        .should(GeneralCodingRules.ACCESS_STANDARD_STREAMS)
        .because("J3: ...")
        .allowEmptyShould(true));
```

2. Create `src/test/resources/archunit.properties` **for the first run only**:

```properties
freeze.store.default.path=src/test/resources/archunit_store
freeze.store.default.allowStoreCreation=true
```

3. Run `./mvnw -q test -Dtest=CodeRulesTest`. The store records today's violations and the
   test passes.
4. Remove `allowStoreCreation=true` (keep the `path` line) and commit the store with the
   test. From now on:
   - a new violation fails the build;
   - a fixed violation drops out of the store on the next run (commit that change).

Verified on the fixture project: first run records and passes, second run passes, a new
`System.out` call then fails.

## Rules

- Only the user decides to freeze; ask before creating a store.
- Never add entries to an existing store by hand or by re-enabling store creation: the
  hooks block edits to `archunit_store/` and `archunit.properties`.
- Review the store size in pull requests; it should only shrink.
