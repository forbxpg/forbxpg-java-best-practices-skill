# DTOs and mapping

## DTOs are records

```java
public record OrderDto(Long id, String number, OrderStatus status) {}

public record CreateOrderRequest(
        @NotBlank String number,
        @NotNull @Positive Long customerId,
        @NotEmpty List<@Valid OrderLineRequest> lines) {}
```

- `*Dto` is the default suffix. `*Request` / `*Response` only for types that exist
  because of an HTTP endpoint.
- Validation annotations sit on record components; the controller adds `@Valid`.
- No entity types inside a DTO, not even nested.
- Collections in records are copied defensively when the record is built from mutable
  input: `lines = List.copyOf(lines)` in a compact constructor.

## The project has MapStruct

```java
@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface OrderMapper {

    OrderDto toDto(Order order);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "status", ignore = true)
    @Mapping(target = "customer", ignore = true)
    void update(UpdateOrderRequest request, @MappingTarget Order order);
}
```

`Order` is the entity from [lombok](lombok.md) (`id`, `number`, `status`, `customer`);
`UpdateOrderRequest(String number)`. Every target property is either mapped or ignored, so
the mapper compiles under `ERROR`. Updating a managed entity with `@MappingTarget` uses its
setters; creating entities goes through a constructor or factory in the service, because the
mapper cannot call the entity's protected no-args constructor from the `mapper` package.

- `unmappedTargetPolicy = ReportingPolicy.ERROR` on every **new** mapper: a field added
  later then breaks compilation instead of silently staying `null`. Several mappers can
  share it through a `@MapperConfig` and `@Mapper(config = ...)`.
- Ignore targets explicitly with `@Mapping(target = ..., ignore = true)` and set
  relations in the service, where the repository is.
- `componentModel = "spring"`: inject the mapper like any bean.
- Lombok must run before MapStruct:

```xml
<annotationProcessorPaths>
    <path><groupId>org.projectlombok</groupId><artifactId>lombok</artifactId><version>${lombok.version}</version></path>
    <path><groupId>org.mapstruct</groupId><artifactId>mapstruct-processor</artifactId><version>${mapstruct.version}</version></path>
    <path><groupId>org.projectlombok</groupId><artifactId>lombok-mapstruct-binding</artifactId><version>0.2.0</version></path>
</annotationProcessorPaths>
```

## The project has no MapStruct

Do not add it for one mapping. Put a static factory on the record:

```java
public record OrderDto(Long id, String number, OrderStatus status) {
    public static OrderDto from(Order order) {
        return new OrderDto(order.getId(), order.getNumber(), order.getStatus());
    }
}
```

Mapping into an entity stays in the service or in a factory method on the entity, so
the entity keeps its invariants.

## Gotchas

- A record component named `id` maps from `getId()` in MapStruct: accessor names match.
- MapStruct with a `@Builder` entity uses the builder; with
  `@NoArgsConstructor(access = PROTECTED)` and no builder it needs a public or
  package-visible no-args constructor or an `@ObjectFactory`.
- Do not map entities to entities. Copying a detached entity onto a managed one is a
  service decision, field by field.
