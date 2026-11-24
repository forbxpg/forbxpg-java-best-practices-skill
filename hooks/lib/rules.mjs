// Rules: hard ones (J1–J6, G1–G2, S1–S2) block, soft ones (W1–W12) come back as remarks.
import { stripCommentsAndStrings } from './javatext.mjs';
import { bootMajor } from './passport.mjs';

export const RULES = {
  J1: { severity: 'hard', short: 'no @Autowired fields; use constructors', message: '@Autowired on a field in production code', fix: 'make the field private final and inject it through the constructor with Lombok @RequiredArgsConstructor', example: '@RequiredArgsConstructor class OrderService { private final OrderRepository orders; }' },
  J2: { severity: 'hard', short: 'jakarta.* imports, never javax.*', message: 'javax.* import in a Spring Boot 3+ project', fix: 'use the jakarta.* package of the same API', example: 'import jakarta.persistence.Entity;' },
  J3: { severity: 'hard', short: 'log with @Slf4j, never System.out', message: 'System.out / System.err / printStackTrace() in production code', fix: 'log through SLF4J (Lombok @Slf4j) and pass the exception as the last argument', example: 'log.error("Order {} failed", orderId, e);' },
  J4: { severity: 'hard', short: '@MockitoBean, not @MockBean', message: '@MockBean / @SpyBean, removed in Spring Boot 4', fix: 'use @MockitoBean / @MockitoSpyBean from org.springframework.test.context.bean.override.mockito', example: '@MockitoBean OrderRepository orders;' },
  J5: { severity: 'hard', short: 'JUnit 5 only, no org.junit.Test', message: 'JUnit 4 API (org.junit.Test or @RunWith); JUnit 4 tests do not run on the JUnit 5 platform', fix: 'use org.junit.jupiter.api.Test and @ExtendWith, or a Spring test slice', example: 'import org.junit.jupiter.api.Test;' },
  J6: { severity: 'hard', short: 'never @Disabled a failing test', message: 'new @Disabled test; disabling a failing test hides the failure', fix: 'fix the code or the test; if it really must wait, ask the user first', example: '@Test void rejectsEmptyOrder() { ... }' },
  W1: { severity: 'soft', short: 'no @Data on @Entity', message: '@Data / @EqualsAndHashCode / @ToString on an @Entity: equals, hashCode and toString over all fields break lazy relations and Set membership', fix: 'use @Getter @Setter @NoArgsConstructor(access = AccessLevel.PROTECTED) and write equals/hashCode on the id', example: '@Entity @Getter @Setter @NoArgsConstructor(access = AccessLevel.PROTECTED) class Order { ... }' },
  W2: { severity: 'soft', short: '@ManyToOne(fetch = LAZY)', message: '@ManyToOne / @OneToOne is EAGER by default', fix: 'set fetch = FetchType.LAZY and fetch what a use case needs with a join fetch or an entity graph', example: '@ManyToOne(fetch = FetchType.LAZY) private Customer customer;' },
  W3: { severity: 'soft', short: '@Enumerated(EnumType.STRING)', message: 'enum stored by position (@Enumerated without EnumType.STRING)', fix: 'store the name so reordering constants does not corrupt data', example: '@Enumerated(EnumType.STRING) private Status status;' },
  W4: { severity: 'soft', short: '@Transactional only on public methods', message: '@Transactional on a private or final method is ignored by the Spring proxy', fix: 'make the method public and non-final, and call it from another bean', example: '@Transactional public void placeOrder(...) { ... }' },
  W5: { severity: 'soft', short: 'never leave a catch block empty', message: 'empty catch block swallows the exception', fix: 'handle it, rethrow it wrapped, or log it with the exception; say why in a comment if ignoring is intended', example: 'catch (IOException e) { throw new UncheckedIOException(e); }' },
  W6: { severity: 'soft', short: 'no @SneakyThrows; declare or wrap', message: '@SneakyThrows hides checked exceptions from callers', fix: 'declare the exception or wrap it in a domain exception', example: 'catch (IOException e) { throw new DocumentReadException(path, e); }' },
  W7: { severity: 'soft', short: 'log with {} placeholders, no +', message: 'string concatenation in a log call', fix: 'use SLF4J placeholders', example: 'log.info("Order {} created", orderId);' },
  W8: { severity: 'soft', short: 'concrete @Service, no *Impl', message: '*Impl class: team convention is a concrete service class without an interface', fix: 'drop the interface unless there are several implementations or a port to an external system', example: '@Service @RequiredArgsConstructor public class OrderService { ... }' },
  W9: { severity: 'soft', short: 'controllers call services, not repos', message: 'controller uses a repository directly', fix: 'call a service; controllers only map HTTP to service calls', example: 'private final OrderService orders;' },
  W10: { severity: 'soft', short: 'MapStruct: unmappedTargetPolicy = ERROR', message: 'MapStruct mapper without unmappedTargetPolicy = ERROR silently leaves new fields null', fix: 'set the policy on the mapper or on a shared @MapperConfig', example: '@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)' },
  W11: { severity: 'soft', short: 'Optional only as a return type', message: 'Optional as a field or parameter', fix: 'use Optional only as a return type; take a nullable value or overload the method', example: 'Optional<Order> findById(Long id);' },
  G1: { severity: 'hard', short: 'new changeset; never edit one on main', message: 'this Liquibase changelog is already on the main branch and may have run on a shared database; Liquibase fails when an applied changeset changes', fix: 'create a new changeset file for the change instead of editing this one', example: 'db/changelog/changes/042-add-order-status.xml' },
  G2: { severity: 'hard', short: 'never edit gate configs; fix the code', message: 'this file holds the team\'s quality-gate rules or their record of tolerated violations', fix: 'fix the code the rule reports; to change a rule, ask the user', example: 'move the repository call from the controller into a service' },
  S1: { severity: 'hard', short: 'no push --force, reset --hard, clean -f', message: 'command rewrites shared history or destroys uncommitted work (git push --force, reset --hard, clean -f)', fix: 'push normally, use git stash, or ask the user to run it themselves', example: 'git stash push -m "wip"' },
  S2: { severity: 'hard', short: 'never skip tests in mvn verify/test', message: 'a Maven gate run with tests or checks skipped proves nothing', fix: 'run the goal without the skip flag and fix what fails; packaging a jar with -DskipTests is fine', example: './mvnw -q verify' },
  W12: { severity: 'soft', short: 'DTOs are records, not @Data classes', message: 'DTO class with @Data where a record fits', fix: 'make the DTO a record (immutable, equals/hashCode for free)', example: 'public record OrderDto(Long id, String number) {}' },
};

const ANNOTATIONS = /@[\w.]+\s*(\([^()]*\))?/g;
const ENTITY = /@([\w.]+\.)?Entity\b/;

/** Text of the annotation arguments that start at `col` on line `i`, or null when there are none. */
function annotationArgs(lines, i, col) {
  let text = lines.slice(i, i + 8).join('\n').slice(col);
  const open = text.search(/\S/);
  if (open < 0 || text[open] !== '(') return null;
  let depth = 0;
  for (let k = open; k < text.length; k += 1) {
    if (text[k] === '(') depth += 1;
    if (text[k] === ')' && --depth === 0) return text.slice(open + 1, k);
  }
  return text.slice(open + 1);
}

/** Lines that annotate the declaration on line i: contiguous non-statement lines above + the prefix on line i. */
function annotationBlock(lines, i, cut) {
  let j = i - 1;
  while (j >= 0) {
    const t = lines[j].trim();
    if (t === '' || /[;{}]$/.test(t)) break;
    j -= 1;
  }
  const block = [];
  for (let k = j + 1; k < i; k += 1) block.push({ idx: k, text: lines[k] });
  block.push({ idx: i, text: lines[i].slice(0, cut) });
  return block;
}

/** Text following line i / column col up to the first ';' or '{' (within 6 lines). */
function declarationAfter(lines, i, col) {
  const text = lines.slice(i, i + 6).join(' ').slice(col);
  const end = text.search(/[;{]/);
  return end < 0 ? { body: text, end: '' } : { body: text.slice(0, end), end: text[end] };
}

export function findViolations(text, { path = '', passport = {} } = {}) {
  const raw = text.split(/\r?\n/);
  const stripped = stripCommentsAndStrings(text);
  const lines = stripped.split(/\r?\n/);
  const p = path.replace(/\\/g, '/');
  const inMain = p.includes('/src/main/');
  const inTest = p.includes('/src/test/');
  const boot = bootMajor(passport) ?? 0;
  const found = [];
  const seen = new Set();
  const add = (id, idx) => {
    const key = `${id}:${idx}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ id, severity: RULES[id].severity, line: idx + 1, message: RULES[id].message, text: (raw[idx] ?? '').trim() });
  };
  const isController = /@(RestController|Controller)\b/.test(stripped);
  const mapstructFile = passport.mapstruct && /import\s+org\.mapstruct\.(Mapper|\*)/.test(stripped);

  lines.forEach((line, i) => {
    // Field injection is idiomatic in Spring tests (@Autowired MockMvc mvc), so J1 skips src/test.
    const autowired = inTest ? -1 : line.search(/@Autowired\b/);
    if (autowired >= 0) {
      const { body, end } = declarationAfter(lines, i, autowired);
      if (end === ';' && !/[()]/.test(body.replace(ANNOTATIONS, ''))) add('J1', i);
    }
    if (boot >= 3 && /^\s*import\s+(static\s+)?javax\.(persistence|validation|servlet)\.|^\s*import\s+javax\.annotation\.PostConstruct\b/.test(line)) add('J2', i);
    if (inMain && /\bSystem\.(out|err)\b|\.printStackTrace\s*\(\s*\)/.test(line)) add('J3', i);
    if (boot >= 4 && /@(MockBean|SpyBean)\b/.test(line)) add('J4', i);
    if (/^\s*import\s+org\.junit\.Test\b|@RunWith\b/.test(line)) add('J5', i);
    if (inTest && /@Disabled\b/.test(line)) add('J6', i);

    for (const m of line.matchAll(/@(ManyToOne|OneToOne)\b/g)) {
      if (!/LAZY/.test(annotationArgs(lines, i, m.index + m[0].length) ?? '')) add('W2', i);
    }
    for (const m of line.matchAll(/@Enumerated\b/g)) {
      if (!/STRING/.test(annotationArgs(lines, i, m.index + m[0].length) ?? '')) add('W3', i);
    }
    const tx = line.search(/@Transactional\b/);
    if (tx >= 0) {
      const { body } = declarationAfter(lines, i, tx);
      const head = body.replace(ANNOTATIONS, '');
      const paren = head.indexOf('(');
      if (paren >= 0 && !/\b(class|interface|record)\b/.test(head) && /\b(private|final)\b/.test(head.slice(0, paren))) add('W4', i);
    }
    if (/@(lombok\.)?SneakyThrows\b/.test(line)) add('W6', i);
    const log = line.match(/\b(log|logger|LOG|LOGGER)\.(trace|debug|info|warn|error)\s*\((.*)/);
    if (log && /"\s*\+|\+\s*"/.test(log[3])) add('W7', i);
    // Spring Data requires the *RepositoryImpl name for custom repository fragments.
    if (/\bclass\s+(?!\w*RepositoryImpl\b)\w+Impl\b/.test(line)) add('W8', i);
    if (isController && !/^\s*import\b/.test(line) && /\b\w*Repository\s+\w+\s*[;,)=]/.test(line)) add('W9', i);
    if (mapstructFile) {
      const mapper = line.search(/@Mapper\b/);
      if (mapper >= 0) {
        const args = annotationArgs(lines, i, mapper + '@Mapper'.length);
        if (args === null || (!/unmappedTargetPolicy/.test(args) && !/\bconfig\s*=/.test(args))) add('W10', i);
      }
    }
    // A field needs an access modifier here: local variables never have one.
    if (/(?:^|[{;])\s*(?:private|protected|public)\s+(?:(?:static|final|transient|volatile)\s+)*Optional<.+?>\s+\w+\s*(;|=)/.test(line)) add('W11', i);
    for (const m of line.matchAll(/\(([^()]*)\)/g)) {
      if (/(^|,)\s*(final\s+)?Optional<[^>]*>\s+\w+\s*$|(^|,)\s*(final\s+)?Optional<[^>]*>\s+\w+\s*,/.test(m[1])) add('W11', i);
    }

    const decl = line.match(/\b(class|record|interface|enum)\s+(\w+)/);
    if (decl && !/^\s*import\b/.test(line)) {
      const block = annotationBlock(lines, i, decl.index);
      const isEntity = block.some((b) => ENTITY.test(b.text));
      for (const b of block) {
        if (isEntity) {
          for (const lombok of b.text.matchAll(/@(lombok\.)?(Data|EqualsAndHashCode|ToString)\b/g)) {
            // Arguments may continue on the next lines; the exception belongs to this annotation only.
            const args = annotationArgs(lines, b.idx, lombok.index + lombok[0].length);
            const explicit = lombok[2] !== 'Data' && args !== null && /onlyExplicitlyIncluded\s*=\s*true/.test(args);
            if (!explicit) add('W1', b.idx);
          }
        }
        if (!isEntity && decl[1] === 'class' && /(Dto|Request|Response)$/.test(decl[2]) && /@(lombok\.)?Data\b/.test(b.text)) add('W12', b.idx);
      }
    }
  });

  for (const m of stripped.matchAll(/catch\s*\([^)]*\)\s*\{(\s*)\}/g)) {
    const braceStart = m.index + m[0].indexOf('{');
    const inside = text.slice(braceStart, m.index + m[0].length);
    if (!/\/\/|\/\*/.test(inside)) add('W5', stripped.slice(0, m.index).split('\n').length - 1);
  }
  return found.sort((a, b) => a.line - b.line || a.id.localeCompare(b.id));
}

/** Violations in `after` that `before` did not have: per rule id, a multiset of trimmed line texts. */
export function newViolations(before, after) {
  const counts = new Map();
  for (const v of before) {
    const key = `${v.id}\u0000${v.text}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return after.filter((v) => {
    const key = `${v.id}\u0000${v.text}`;
    const left = counts.get(key) ?? 0;
    if (left > 0) {
      counts.set(key, left - 1);
      return false;
    }
    return true;
  });
}

/** Hard rules have no in-session override: the user changes the code or disables the rule in forbxpg-java.json. */
const HARD_SUFFIX = 'If the user explicitly asked for this, stop and ask the user to make the change themselves or to add the rule id to "disable" in forbxpg-java.json; do not retry or work around it';

export function formatViolation(v) {
  const rule = RULES[v.id];
  const where = v.line > 0 ? ` (line ${v.line})` : '';
  const text = `[forbxpg-java] ${v.id}: ${rule.message}${where}. Fix: ${rule.fix}. Example: ${rule.example}`;
  return rule.severity === 'hard' ? `${text}. ${HARD_SUFFIX}` : text;
}
