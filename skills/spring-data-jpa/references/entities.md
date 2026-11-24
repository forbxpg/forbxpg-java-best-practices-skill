# Entities

## Shape

```java
@Entity
@Table(name = "orders")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Version
    private Long version;

    @Column(nullable = false, length = 32, unique = true)
    private String number;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private OrderStatus status = OrderStatus.NEW;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<OrderLine> lines = new HashSet<>();

    public void addLine(OrderLine line) {
        lines.add(line);
        line.setOrder(this);
    }

    public void removeLine(OrderLine line) {
        lines.remove(line);
        line.setOrder(null);
    }

    // equals / hashCode on id: see java-conventions references/lombok.md
}
```

## Rules

- Column definitions mirror the Liquibase changeset (nullability, lengths, uniqueness);
  `ddl-auto: validate` checks names and types at startup.
- Ids: `IDENTITY` for PostgreSQL identity columns; `SEQUENCE` with `allocationSize`
  matching the sequence increment when the schema uses sequences. Follow the schema.
- Cascades flow from the owner of the lifecycle to its parts (`Order → OrderLine`),
  never from a child to a parent.
- Collections: initialise inline, expose add / remove helpers, do not replace the
  collection instance (`setLines(newList)` breaks orphan removal).
- Domain behaviour that keeps the entity valid (`order.cancel()`) lives on the entity;
  orchestration across entities lives in the service.
- Time columns: `Instant` or `OffsetDateTime`; audit fields with `@CreatedDate` /
  `@LastModifiedDate` and `@EnableJpaAuditing`.
- Large text or binary: lazy basic fetch rarely works without bytecode enhancement —
  move such data to a separate entity or table.

## Optimistic locking

- `@Version` field (`Long` or `Integer`), never set by hand.
- A concurrent update throws `ObjectOptimisticLockingFailureException`; map it to `409`
  in the advice.
- Updates from a DTO carry the version the client saw and check it.

## Inheritance

Prefer composition. When inheritance is needed, `SINGLE_TABLE` is the simplest and
fastest; `JOINED` for strongly different subclasses; avoid `TABLE_PER_CLASS`.
