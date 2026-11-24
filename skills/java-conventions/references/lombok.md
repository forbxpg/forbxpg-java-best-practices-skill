# Lombok by role

Lombok is mandatory in the team's projects. Use it to remove boilerplate, not to hide
behaviour.

| Role | Use | Never |
|---|---|---|
| `@Service`, `@Component`, `@RestController` | `@RequiredArgsConstructor` with `private final` fields; `@Slf4j` | `@Autowired` fields, `@AllArgsConstructor` for injection, `@Data` |
| `@Entity` | `@Getter`, `@Setter`, `@NoArgsConstructor(access = AccessLevel.PROTECTED)`; `@Builder` + `@AllArgsConstructor(access = AccessLevel.PRIVATE)` when a builder helps | `@Data`, `@EqualsAndHashCode`, `@ToString`, `@Value` |
| DTO | a **record**, no Lombok | `@Data` on a new DTO class |
| Legacy DTO class (already `@Data`) | keep it; convert to a record only when you change it anyway | spreading `@Data` to new classes |
| Value object (not an entity) | a record, or `@Value` when it needs a builder | mutable setters |
| Exceptions | plain constructors | `@SneakyThrows` anywhere |
| Configuration properties | a record | `@Data` + `@Component` |

## Entity template

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

    @Column(nullable = false)
    private String number;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderStatus status;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id")
    private Customer customer;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Order other)) return false;
        return id != null && id.equals(other.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
```

`hashCode` is constant per class so an entity keeps its hash when the id is assigned
on save; `equals` compares ids only when both are set.

## Service template

```java
@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orders;
    private final OrderMapper mapper;

    @Transactional(readOnly = true)
    public OrderDto get(Long id) {
        return orders.findById(id).map(mapper::toDto).orElseThrow(() -> new OrderNotFoundException(id));
    }
}
```

## Why not `@Data` on entities

- `equals` / `hashCode` over all fields change when a field changes: the entity gets
  lost inside a `HashSet`, and touching lazy fields triggers queries or
  `LazyInitializationException`.
- `toString` walks relations: endless recursion on bidirectional mappings and accidental
  loading in logs.

## `lombok.config`

The team's projects either have no `lombok.config` or set:

```properties
config.stopBubbling = true
lombok.addLombokGeneratedAnnotation = true
lombok.copyableAnnotations += org.springframework.beans.factory.annotation.Qualifier
```

`addLombokGeneratedAnnotation` keeps generated code out of JaCoCo coverage;
`copyableAnnotations` makes `@Qualifier` on a field reach the generated constructor
parameter. Add the file only when the project needs one of these.
