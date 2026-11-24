# Modern Java features (21)

## Records

- Data carriers with value semantics. Compact constructor for validation and defensive
  copies:

```java
public record Order(String number, List<Line> lines) {
    public Order {
        if (number == null || number.isBlank()) throw new IllegalArgumentException("number is blank");
        lines = List.copyOf(lines);
    }
}
```

- Static factories for alternative construction: `Order.empty(number)`.
- Records can implement interfaces and have methods; they cannot extend classes or have
  instance fields beyond components.

## Sealed types

`sealed interface Shape permits Circle, Square {}` — a closed set the compiler knows.
Combine with records and pattern `switch` for exhaustive handling. Use for results,
commands and states that have a fixed set of variants.

## Pattern matching

```java
if (event instanceof OrderPlaced(var id, var total) && total.signum() > 0) { ... }

String label = switch (status) {
    case NEW, PAID -> "open";
    case SHIPPED -> "in transit";
    case DELIVERED, CANCELLED -> "closed";
};

Object value = ...;
String text = switch (value) {
    case null -> "none";
    case Integer i when i > 0 -> "positive " + i;
    case Integer i -> "number " + i;
    case String s -> s;
    default -> value.toString();
};
```

Guarded cases (`when`) go before the unguarded case of the same type.

## Collections

- Factories: `List.of`, `Set.of`, `Map.of`, `Map.entry` — immutable, reject `null`.
- Sequenced collections (21): `list.getFirst()`, `getLast()`, `reversed()`;
  `LinkedHashMap.firstEntry()`.
- Choose by access pattern: `ArrayList` by default, `ArrayDeque` for queues and stacks,
  `HashMap` / `LinkedHashMap` (insertion order), `EnumMap` / `EnumSet` for enum keys.
- Size known in advance: `new ArrayList<>(n)`, `HashMap.newHashMap(n)`.

## Streams

- Use for transformations: `filter → map → collect`. Keep lambdas short; extract a
  method when a lambda needs a block.
- `toList()` for an unmodifiable result; `Collectors.groupingBy`, `toMap` with a merge
  function when keys can repeat.
- No streams for simple loops with early exit or checked exceptions; a `for` loop reads
  better.
- Parallel streams: only for CPU-bound work on large data, never inside a request with
  blocking I/O.

## Strings

- Text blocks `"""` for SQL, JSON and multi-line messages; `formatted(...)` for values.
- `StringBuilder` in loops; `String.join` / `Collectors.joining` for lists.
- `isBlank()`, `strip()`, `lines()`, `repeat()` instead of hand-written helpers.

## Null handling

- Validate inputs at the boundary (`Objects.requireNonNull` in constructors, Bean
  Validation on DTOs) and keep the inside null-free.
- Spring Framework 7 / Boot 4 annotate their APIs with JSpecify (`@Nullable` from
  `org.jspecify.annotations`). Use the same annotations in new code when the project
  already depends on JSpecify.
