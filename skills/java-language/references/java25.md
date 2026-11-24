# Java 25 vs 21

Java 25 is an LTS release. Use these only when the passport says `Java 25`.

| Feature | Java 21 | Java 25 |
|---|---|---|
| Unnamed variables and patterns `_` | preview | final (since 22) |
| Stream gatherers `stream.gather(...)` | — | final (since 24) |
| Foreign Function & Memory API | preview | final (since 22) |
| Compact source files and instance `void main()` | preview | final (JEP 512) |
| Module import declarations `import module java.base;` | — | final (JEP 511) |
| Flexible constructor bodies (statements before `super(...)`) | — | final (JEP 513) |
| Scoped values | preview | final (JEP 506) |
| `synchronized` no longer pins virtual threads | pins | fixed (since 24) |
| Structured concurrency | preview | preview |
| Primitive types in patterns | — | preview |
| Stable values | — | preview |

## Rules

- Preview features need `--enable-preview` at compile and run time. Do not add the flag
  to a project that does not already use it.
- On Java 21 a compact source file (`void main() { ... }` without a class) fails with
  "unnamed classes are a preview feature" — use a normal class.
- Unnamed variables in Java 25: `catch (NumberFormatException _)`, `case Point(var x, _)`,
  `for (var _ : items)`.
- Flexible constructor bodies: validate arguments before `super(...)` instead of a
  static helper.
- Scoped values replace `ThreadLocal` for passing request context to virtual threads.

## Upgrading a project 21 → 25

1. Raise `maven.compiler.release` (or `java.version`) and the Enforcer range.
2. Check Lombok, MapStruct, Error Prone and ArchUnit versions support 25 (current
   releases do; old Lombok fails with an unsupported class-file error).
3. Build with `-Xlint:all` and fix new deprecation warnings.
4. Run the full test suite; behaviour changes are rare but real in security providers
   and locale data.
