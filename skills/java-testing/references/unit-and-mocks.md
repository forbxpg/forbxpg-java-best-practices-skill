# Unit tests and mocks

## Structure

```java
class PriceCalculatorTest {

    private final PriceCalculator calculator = new PriceCalculator(Clock.fixed(NOW, ZoneOffset.UTC));

    @Test
    void appliesTenPercentDiscountFromThreeItems() {
        var order = OrderFixtures.withItems(3, new BigDecimal("100.00"));

        var price = calculator.total(order);

        assertThat(price).isEqualByComparingTo("270.00");
    }
}
```

- No Spring context for plain classes: construct them with `new` and real or fake
  collaborators.
- Use `@ExtendWith(MockitoExtension.class)` + `@Mock` / `@InjectMocks` only for
  collaborators that do I/O (repositories, clients, clocks you cannot inject).
- Strict stubs (Mockito's default with the extension) fail on unused stubbing: remove
  stubs the test does not need.

## What to mock

| Mock | Do not mock |
|---|---|
| repositories, HTTP clients, message senders | the class under test |
| `Clock` (or pass `Clock.fixed`) | records, DTOs, entities, value objects |
| expensive or nondeterministic services | collections, `Optional`, mappers you can run for real |

## AssertJ

```java
assertThat(result).extracting(OrderDto::status).isEqualTo(OrderStatus.CANCELLED);
assertThat(orders).extracting(OrderDto::number).containsExactly("A-1", "A-2");
assertThat(amount).isEqualByComparingTo("10.00");          // BigDecimal
assertThatThrownBy(() -> service.get(99L)).isInstanceOf(OrderNotFoundException.class);
assertThat(saved).usingRecursiveComparison().ignoringFields("id", "version").isEqualTo(expected);
```

## Captors and verification

```java
ArgumentCaptor<PaymentRequest> request = ArgumentCaptor.forClass(PaymentRequest.class);
verify(payments).create(request.capture());
assertThat(request.getValue().amount()).isEqualByComparingTo("270.00");
```

Verify only interactions that are the point of the behaviour.

## Parameterized tests

```java
@ParameterizedTest
@CsvSource({"0, false", "1, true", "100, true"})
void acceptsPositiveQuantity(int quantity, boolean valid) {
    assertThat(validator.isValid(quantity)).isEqualTo(valid);
}
```

Use them for boundaries and tables of rules, not to compress unrelated cases.

## Test data

- `OrderFixtures.order().status(SHIPPED).build()` style builders in `src/test/java`.
- Only the fields the test cares about are set explicitly; the rest get valid defaults.
- Fake data only: no real names, account numbers, tokens or internal hosts.
