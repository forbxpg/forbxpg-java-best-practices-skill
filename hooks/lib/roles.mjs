// File roles and the short rules a model gets the first time it writes a file of that role.
import { stripCommentsAndStrings } from './javatext.mjs';

export const ROLE_RULES = {
  controller: [
    '- Map HTTP to one service call; no business logic, no repositories, no entities in or out.',
    '- Request/response types are records (*Request / *Response / *Dto); validate with @Valid.',
    '- Errors are ProblemDetail from the @RestControllerAdvice; do not catch exceptions here.',
    '- Inject with @RequiredArgsConstructor and private final fields.',
  ].join('\n'),
  service: [
    '- Concrete @Service class, no interface + *Impl; @RequiredArgsConstructor, @Slf4j.',
    '- @Transactional on public methods only; readOnly = true for reads; no HTTP calls inside a transaction.',
    '- Calling your own @Transactional/@Async method from this class skips the proxy.',
    '- Return DTOs or domain objects, never ResponseEntity.',
  ].join('\n'),
  repository: [
    '- Extend JpaRepository; derived queries or @Query with JPQL; no business logic.',
    '- Fetch what a use case needs: join fetch or @EntityGraph against N+1.',
    '- Return Optional for single results, Page/Slice for lists that can grow.',
  ].join('\n'),
  entity: [
    '- @Getter @Setter @NoArgsConstructor(access = PROTECTED); never @Data, @EqualsAndHashCode, @ToString.',
    '- equals/hashCode on the id; @ManyToOne/@OneToOne(fetch = LAZY); @Enumerated(EnumType.STRING).',
    '- Schema changes go in a new Liquibase changeset, never ddl-auto.',
  ].join('\n'),
  dto: [
    '- Prefer a record: public record OrderDto(Long id, String number) {}.',
    '- Suffix *Dto; *Request / *Response only at the HTTP boundary.',
    '- Validation annotations on record components; no entity types inside.',
  ].join('\n'),
  mapper: [
    '- MapStruct: @Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR).',
    '- Map explicitly with @Mapping when names differ; ignore fields with @Mapping(target, ignore = true).',
    '- No MapStruct in the project: static factory in the record, e.g. OrderDto.from(order).',
  ].join('\n'),
  config: [
    '- Group settings in a @ConfigurationProperties record with validation, not scattered @Value.',
    '- HTTP clients get connect and read timeouts here.',
    '- Profiles in application-<profile>.yml; no secrets in the repository.',
  ].join('\n'),
  'exception-handler': [
    '- One @RestControllerAdvice; return ProblemDetail with a stable type and title.',
    '- Map domain exceptions to 4xx; the catch-all 500 never returns the exception message.',
    '- Log 5xx once with the exception; do not log 4xx as errors.',
  ].join('\n'),
  test: [
    '- JUnit 5 + AssertJ; name tests after behaviour; positive and negative cases.',
    '- Slices: @WebMvcTest, @DataJpaTest (H2); @MockitoBean, not @MockBean.',
    '- Take cases from the contract, not from the implementation; never @Disabled a failing test.',
  ].join('\n'),
  liquibase: [
    '- Never edit a changeset that reached main: add a new changelog file.',
    '- One logical change per changeset; id and author set; add a rollback for DDL that has none.',
    '- Name constraints and indexes explicitly; index foreign keys.',
  ].join('\n'),
};

const ANNOTATION_ROLES = [
  [/@(RestControllerAdvice|ControllerAdvice)\b/, 'exception-handler'],
  [/@(RestController|Controller)\b/, 'controller'],
  [/@([\w.]+\.)?Entity\b/, 'entity'],
  // MapStruct only: MyBatis also has a @Mapper annotation.
  [(code) => /org\.mapstruct/.test(code) && /@Mapper\b/.test(code), 'mapper'],
  [/@Repository\b|\bextends\s+(Jpa|Crud|PagingAndSorting|ListCrud)Repository\b/, 'repository'],
  [/@Service\b/, 'service'],
  [/@(Configuration|ConfigurationProperties)\b/, 'config'],
];
const NAME_ROLES = [
  [/Controller$/, 'controller'],
  [/Service$/, 'service'],
  [/Repository$/, 'repository'],
  [/Mapper$/, 'mapper'],
  [/(Config|Configuration|Properties)$/, 'config'],
  [/(Dto|Request|Response)$/, 'dto'],
];

export function detectRole(path, text) {
  const p = path.replace(/\\/g, '/');
  if (p.includes('/src/test/')) return 'test';
  if (/(^|\/)db\/changelog\//.test(p)) return 'liquibase';
  if (!p.endsWith('.java')) return null;
  const code = stripCommentsAndStrings(text);
  for (const [match, role] of ANNOTATION_ROLES) {
    if (typeof match === 'function' ? match(code) : match.test(code)) return role;
  }
  const name = p.slice(p.lastIndexOf('/') + 1, -'.java'.length);
  for (const [re, role] of NAME_ROLES) if (re.test(name)) return role;
  return null;
}
