import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findViolations, newViolations, formatViolation } from '../hooks/lib/rules.mjs';
import { stripCommentsAndStrings } from '../hooks/lib/javatext.mjs';

const MAIN = '/p/src/main/java/a/Foo.java';
const TEST = '/p/src/test/java/a/FooTest.java';
const boot4 = { boot: '4.1.1', mapstruct: true };
const boot2 = { boot: '2.7.18', mapstruct: false };

const ids = (text, path = MAIN, passport = boot4) => findViolations(text, { path, passport }).map((v) => v.id);
const has = (id, text, path, passport) => ids(text, path, passport).includes(id);

const cases = {
  J1: {
    catch: [['class A {\n  @Autowired\n  private Foo foo;\n}'], ['class A { @Autowired(required = false) @Qualifier("x") private Foo foo; }']],
    miss: [['class T { @Autowired MockMvc mvc; }', TEST], ['class A {\n  @Autowired\n  A(Foo foo) {}\n}'], ['class A { A(@Autowired Foo foo) {} }'], ['class A {\n  @Autowired\n  void set(Foo foo) {}\n}']],
  },
  J2: {
    catch: [['import javax.persistence.Entity;'], ['import javax.validation.Valid;'], ['import javax.servlet.Filter;'], ['import javax.annotation.PostConstruct;']],
    miss: [['import javax.persistence.Entity;', MAIN, boot2], ['import jakarta.persistence.Entity;'], ['import javax.sql.DataSource;']],
  },
  J3: {
    catch: [['class A { void f() { System.out.println(1); } }'], ['class A { void f() { e.printStackTrace(); } }'], ['class A { void f() { System.err.print(1); } }']],
    miss: [['class A { void f() { System.out.println(1); } }', TEST], ['class A { void f() { log.error("x", e); } }']],
  },
  J4: {
    catch: [['class T { @MockBean Foo foo; }', TEST], ['class T { @SpyBean Foo foo; }', TEST]],
    miss: [['class T { @MockBean Foo foo; }', TEST, { boot: '3.4.0' }], ['class T { @MockitoBean Foo foo; }', TEST]],
  },
  J5: {
    catch: [['import org.junit.Test;', TEST], ['@RunWith(SpringRunner.class) class T {}', TEST]],
    miss: [['import org.junit.jupiter.api.Test;', TEST]],
  },
  J6: {
    catch: [['class T { @Disabled @Test void t() {} }', TEST]],
    miss: [['class T { @Disabled @Test void t() {} }', MAIN]],
  },
  W1: {
    catch: [['@Entity\n@Data\npublic class Order {}'], ['@lombok.EqualsAndHashCode\n@Entity\nclass Order {}'], ['@Entity @ToString class Order {}']],
    miss: [['@Data\npublic class OrderDto {}'], ['@Entity\n@Getter\n@Setter\nclass Order {}'], ['@Entity @ToString(onlyExplicitlyIncluded = true) class O {}'], ['@Entity\n@EqualsAndHashCode(onlyExplicitlyIncluded = true)\nclass O {}']],
  },
  W2: {
    catch: [['class O { @ManyToOne private Customer c; }'], ['class O {\n  @OneToOne(\n    optional = false)\n  private Customer c;\n}']],
    miss: [['class O { @ManyToOne(fetch = FetchType.LAZY) private Customer c; }'], ['class O {\n  @OneToOne(optional = false,\n    fetch = FetchType.LAZY)\n  Customer c;\n}']],
  },
  W3: {
    catch: [['class O { @Enumerated Status s; }'], ['class O { @Enumerated(EnumType.ORDINAL) Status s; }']],
    miss: [['class O { @Enumerated(EnumType.STRING) Status s; }']],
  },
  W4: {
    catch: [['class S {\n  @Transactional\n  private void save() {}\n}'], ['class S {\n  @Transactional\n  public final void save() {}\n}']],
    miss: [['class S {\n  @Transactional\n  public void save() {}\n}']],
  },
  W5: {
    catch: [['class A { void f() { try { g(); } catch (Exception e) { } } }'], ['class A { void f() { try { g(); } catch (IOException e) {\n} } }']],
    miss: [['class A { void f() { try { g(); } catch (Exception e) { /* expected */ } } }'], ['class A { void f() { try { g(); } catch (Exception e) { log.warn("x", e); } } }']],
  },
  W6: { catch: [['class A { @SneakyThrows void f() {} }']], miss: [['class A { void f() throws IOException {} }']] },
  W7: {
    catch: [['class A { void f() { log.info("id=" + id); } }'], ['class A { void f() { logger.warn(id + " failed"); } }']],
    miss: [['class A { void f() { log.info("id={}", id); } }'], ['class A { void f() { String s = "a" + b; } }']],
  },
  W8: { catch: [['public class OrderServiceImpl implements OrderService {}']], miss: [['public class OrderService {}'], ['class OrderRepositoryImpl implements OrderRepositoryCustom {}']] },
  W9: {
    catch: [['@RestController\nclass C {\n  private final OrderRepository orders;\n}']],
    miss: [['@Service\nclass S {\n  private final OrderRepository orders;\n}'], ['@RestController\nclass C {\n  private final OrderService orders;\n}']],
  },
  W10: {
    catch: [['import org.mapstruct.Mapper;\n@Mapper\ninterface M {}'], ['import org.mapstruct.Mapper;\n@Mapper(componentModel = "spring")\ninterface M {}']],
    miss: [
      ['import org.mapstruct.Mapper;\n@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)\ninterface M {}'],
      ['import org.mapstruct.Mapper;\n@Mapper(config = Cfg.class)\ninterface M {}'],
      ['import org.mapstruct.Mapper;\n@Mapper\ninterface M {}', MAIN, boot2],
      ['import org.apache.ibatis.annotations.Mapper;\n@Mapper\ninterface M {}'],
    ],
  },
  W11: {
    catch: [['class A { private Optional<String> name; }'], ['class A { void f(Optional<String> name) {} }']],
    miss: [['class A { Optional<String> f() { return Optional.of(x); } }'], ['class A { void f() {\n    Optional<Foo> found = repo.find(id);\n  } }']],
  },
  W12: {
    catch: [['@Data\npublic class OrderDto {\n  private Long id;\n}']],
    miss: [['public record OrderDto(Long id) {}'], ['@Entity\n@Data\nclass OrderDto {}']],
  },
};

for (const [id, { catch: hits, miss }] of Object.entries(cases)) {
  test(`${id} catches`, () => {
    for (const [text, path, passport] of hits) assert.ok(has(id, text, path, passport), `${id} should catch: ${text}`);
  });
  test(`${id} does not catch`, () => {
    for (const [text, path, passport] of miss) assert.ok(!has(id, text, path, passport), `${id} should not catch: ${text}`);
  });
}

test('Review Focus 3: patterns inside comments and string literals do not trigger', () => {
  const text = [
    'class A {',
    '  // @Autowired private Foo foo;',
    '  /* System.out.println(1); */',
    '  String s = "@Autowired private Foo foo; System.out.println";',
    '  String t = """',
    '    import javax.persistence.Entity;',
    '    """;',
    '}',
  ].join('\n');
  assert.deepEqual(ids(text), []);
});

test('stripCommentsAndStrings keeps the line count and quote characters', () => {
  const text = 'a // x\n"b\\"c" /* d\ne */ f';
  const stripped = stripCommentsAndStrings(text);
  assert.equal(stripped.split('\n').length, text.split('\n').length);
  assert.ok(stripped.startsWith('a '));
  assert.ok(!stripped.includes('x') && !stripped.includes('b') && !stripped.includes('d'));
  assert.ok(stripped.includes('"') && stripped.endsWith(' f'));
});

test('violations report 1-based line numbers, also for CRLF text', () => {
  const [v] = findViolations('class A {\r\n  @Autowired\r\n  private Foo foo;\r\n}', { path: MAIN, passport: boot4 });
  assert.equal(v.id, 'J1');
  assert.equal(v.line, 2);
  assert.equal(v.severity, 'hard');
});

test('newViolations keeps only violations the edit introduced', () => {
  const before = 'class A {\n  @Autowired\n  private Foo foo;\n}';
  const after = 'class A {\n  @Autowired\n  private Foo foo;\n  @Autowired\n  private Bar bar;\n  void f() {}\n}';
  const ctx = { path: MAIN, passport: boot4 };
  const fresh = newViolations(findViolations(before, ctx), findViolations(after, ctx));
  assert.equal(fresh.length, 1);
  assert.equal(fresh[0].line, 4);
  assert.deepEqual(newViolations(findViolations(before, ctx), findViolations(before.replace('}', '  void g() {}\n}'), ctx)), []);
});

test('formatViolation has the global message shape', () => {
  const [v] = findViolations('class A { @Autowired private Foo foo; }', { path: MAIN, passport: boot4 });
  assert.match(formatViolation(v), /^\[forbxpg-java\] J1: .+\. Fix: .+\. Example: .+/);
  assert.match(formatViolation(v), /@RequiredArgsConstructor/);
});

test('Review Focus 5: 2 000-line file, two scans and a diff under 300 ms', () => {
  const body = Array.from({ length: 2000 }, (_, i) => (i % 50 === 0 ? `  @Transactional\n  public void m${i}() { log.info("x={}", ${i}); }` : `  private int f${i} = ${i}; // note`)).join('\n');
  const text = `@Service\n@RequiredArgsConstructor\nclass Big {\n${body}\n}`;
  const ctx = { path: MAIN, passport: boot4 };
  const start = performance.now();
  newViolations(findViolations(text, ctx), findViolations(`${text}\n// tail`, ctx));
  assert.ok(performance.now() - start < 300, `took ${performance.now() - start} ms`);
});
