# Outbound HTTP clients

## Choice

| Project has | New client |
|---|---|
| Feign (`@FeignClient`) | keep Feign for consistency; configure timeouts |
| `RestClient` | `RestClient` or an `@HttpExchange` interface backed by it |
| Nothing yet | an `@HttpExchange` interface backed by `RestClient` |

`RestTemplate` is in maintenance; `WebClient` only in reactive applications.

## RestClient with timeouts

```java
@Configuration
@RequiredArgsConstructor
public class PaymentClientConfig {

    private final PaymentProperties props;

    @Bean
    RestClient paymentRestClient(RestClient.Builder builder) {
        var requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(props.connectTimeout());
        requestFactory.setReadTimeout(props.readTimeout());
        return builder
                .baseUrl(props.baseUrl().toString())
                .requestFactory(requestFactory)
                .build();
    }

    @Bean
    PaymentClient paymentClient(RestClient paymentRestClient) {
        return HttpServiceProxyFactory.builderFor(RestClientAdapter.create(paymentRestClient))
                .build()
                .createClient(PaymentClient.class);
    }
}

@HttpExchange("/api/v1/payments")
public interface PaymentClient {
    @PostExchange
    PaymentResponse create(@RequestBody PaymentRequest request);

    @GetExchange("/{id}")
    PaymentResponse get(@PathVariable String id);
}
```

- Use the injected `RestClient.Builder` (it carries Boot's message converters and
  observability), never `RestClient.create()`.
- `SimpleClientHttpRequestFactory` is the JDK client and works on Boot 3 and 4; switch to
  the Apache or JDK `HttpClient` factory only when the project already uses one (pooling,
  proxies).
- Base URL and timeouts come from a `@ConfigurationProperties` record.
- Map remote errors to domain exceptions in one place (`defaultStatusHandler` or a
  wrapper), so services do not see `HttpClientErrorException`.

## Feign timeouts

```yaml
spring:
  cloud:
    openfeign:
      client:
        config:
          default:
            connect-timeout: 2000
            read-timeout: 5000
```

## Retries

- Retry only idempotent calls (GET, PUT with the same body, POST with an idempotency
  key), with a bounded number of attempts and backoff.
- Boot 4 / Spring Framework 7: `@Retryable` from `org.springframework.resilience.annotation`,
  switched on by `@EnableResilientMethods`. Boot 3: Spring Retry (`@EnableRetry`) or
  Resilience4j. An annotation without its switch does nothing.
- Never retry inside a transaction.

## Tests

Test clients against a stub server (WireMock or `MockRestServiceServer`), including a
timeout and a 5xx response.
