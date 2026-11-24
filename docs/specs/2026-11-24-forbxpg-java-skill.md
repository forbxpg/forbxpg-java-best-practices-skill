# Спецификация: forbxpg-java — скилл для агентной Java-разработки

Статус: **одобрена 24.11.2026**, уточнена по итогам ревью (пометки «уточнено по ревью»).
Основание: журнал решений (24 решения) по итогам разбора десяти публичных коллекций Java-скиллов
и пробы хуков GigaCode; журнал и факты рабочей среды хранятся вне репозитория.

## 1. Цель

Агент — Claude Code, GigaCode (модель класса Flash, 262k контекста) или Codex — пишет Java / Spring
Boot код по конвенциям команды и best practices. Правило работает, даже когда модель его
забыла: жёсткие правила проверяет хук до записи файла, мягкие приходят замечанием после
записи.

**Измеримый результат первой версии:**
- агент не может записать в `.java` нарушение жёсткого правила (раздел 5.3): хук
  блокирует, модель получает причину и исправление;
- после каждой правки `.java` модель получает найденные мягкие нарушения именно в этой
  правке;
- скилл ставится одной командой в каждом из трёх агентов и работает без сети, без bash и
  без PowerShell (Windows 10 + cmd + Node);
- тесты хуков зелёные на Windows, Linux и macOS.

## 2. Границы

**Входит:** Java 21 (основная) и 25; Spring Boot 4 (основной) и 3 (отличия в reference);
Maven; plain Java; Lombok (обязателен); MapStruct; Liquibase; JUnit 5 + AssertJ + Mockito;
H2 и Testcontainers (если есть Docker); ArchUnit, Checkstyle, SpotBugs, JaCoCo, Enforcer —
то, что уже есть в корпоративном зеркале артефактов.

**Не входит (v1):** Gradle, Quarkus, Jakarta EE без Spring, Kotlin, WebFlux глубже
упоминания, Spring Cloud / Kubernetes / observability-стек, Spring AI, генератор проектов,
A/B-испытания скиллов (план на v2).

## 3. Раскладка репозитория

```
forbxpg-java-best-practices-skill/
├── skills/                          # Agent Skills: по папке на скилл
│   ├── using-java-best-practices/   # всегда загружен (роутер)
│   ├── java-conventions/
│   ├── java-language/
│   ├── spring-boot-service/
│   ├── spring-data-jpa/
│   ├── java-testing/
│   ├── java-code-review/
│   ├── java-verification/
│   └── java-quality-gates/
├── hooks/
│   ├── java-hooks.mjs               # единая точка входа: node java-hooks.mjs <Event> --harness <h>
│   ├── lib/                         # passport, checks, roles, guard, state, io — без зависимостей
│   └── hooks.json                   # Claude Code
├── gigacode-extension.json          # GigaCode: contextFileName + skills + hooks
├── .claude-plugin/plugin.json       # Claude Code
├── .codex-plugin/plugin.json        # Codex (+ hooks-codex.json)
├── scripts/                         # Node: validate-skills, check-tokens, eval-routing
├── evals/routing.tsv                # промпт → ожидаемый скилл
├── tests/                           # node --test: хуки и скрипты на фикстурах
│   └── fixtures/                    # мини-проекты и stdin-примеры трёх агентов
├── docs/{ru,en}/                    # установка, как работает, настройка
├── README.md, README.ru.md, CHANGELOG.md, LICENSE (MIT), NOTICE
└── private/                         # в .gitignore
```

Всё исполняемое — Node ≥ 20 без npm-зависимостей: `node:fs`, `node:path`, `node:test`.
Ни bash, ни PowerShell, ни Python.

## 4. Скиллы

Общие требования:
- Язык — английский. Frontmatter — `name` (регулярка GigaCode `^[\p{L}\p{N}_:.-]+$`) и
  `description` ≤ 1024 символов. Другие поля — только из спецификации Agent Skills.
- `SKILL.md` ≤ 150 строк: workflow с шагами проверки, MUST / MUST NOT, пример правильного
  кода рядом с правилом, «Gotchas», таблица «Reference → Load when».
- Reference ≤ 250 строк, одна тема на файл.
- Отличия Boot 3 и Java 25 — отдельный reference в скилле, где они важны. Копий скиллов
  под версии нет.

| Скилл | Срабатывает, когда | Содержание | References |
|---|---|---|---|
| `using-java-best-practices` | всегда (контекст-файл / SessionStart) | паспорт проекта, ~12 главных правил, таблица «какой скилл когда», правило маленьких шагов и Verification block. **≤ 1 500 токенов** | — |
| `java-conventions` | создание классов, пакетов, модулей, нового проекта; вопросы «куда положить», «как назвать» | раскладка Maven-проекта и модулей; пакеты по слоям `config, controller, dto, entity, exception, mapper, repository, service` (+ `client`, `facade`); именование; правила Lombok по ролям; DTO — records `*Dto`, на границе API `*Request` / `*Response`; сервисы — классы без `*Impl`; MapStruct с `unmappedTargetPolicy = ERROR` или фабрики в records; `application.yml`, профили, `@ConfigurationProperties` | `lombok.md`, `packages-and-naming.md`, `dto-and-mapping.md`, `configuration.md` |
| `java-language` | код на Java без Spring-специфики: records, sealed, pattern matching, Optional, исключения, коллекции и стримы, конкурентность | современная Java 21; null-safety; исключения; virtual threads и `CompletableFuture`; неизменяемость | `modern-java.md`, `exceptions.md`, `concurrency.md`, `java25.md` |
| `spring-boot-service` | контроллеры, сервисы, конфигурация, HTTP-клиенты, транзакции, `@Async` / `@Scheduled`, обработка ошибок | DI через `@RequiredArgsConstructor`; валидация; `ProblemDetail` + `@RestControllerAdvice`; `RestClient` / `@HttpExchange` / Feign с таймаутами; ловушки прокси (self-invocation, private / final); транзакции и HTTP внутри транзакции; actuator | `web-and-errors.md`, `http-clients.md`, `transactions-and-proxies.md`, `async-scheduling.md`, `boot3-differences.md` |
| `spring-data-jpa` | сущности, репозитории, запросы, N+1, `LazyInitializationException`, Liquibase | сущности без `@Data`: `@Getter @Setter @NoArgsConstructor(PROTECTED)`, `equals` / `hashCode` по id; LAZY; `EnumType.STRING`; `@Version`; проекции и пагинация; `open-in-view: false`; Liquibase: только новые changeset-ы | `entities.md`, `queries-and-n-plus-1.md`, `liquibase.md` |
| `java-testing` | написать или исправить тесты, покрытие | JUnit 5 + AssertJ + Mockito; слайсы `@WebMvcTest` / `@DataJpaTest` на H2 и честное предупреждение про диалект; Testcontainers только при Docker; `@MockitoBean`; кейсы из контракта, а не из реализации; негативные кейсы | `unit-and-mocks.md`, `slices-and-h2.md`, `testcontainers.md` |
| `java-code-review` | «проверь код», «ревью», перед коммитом / PR; чеклист для `mentor` | одно ревью по областям: корректность, конкурентность, производительность, безопасность, API-контракт, тесты, конвенции; формат замечаний с серьёзностью | `correctness.md`, `concurrency.md`, `performance.md`, `security.md`, `api-contract.md`, `tests.md` |
| `java-verification` | перед словами «готово», «тесты проходят», «собирается» | какую команду гонять (`mvnw` или `mvn`, `-o`, модуль); как читать Surefire / Failsafe; Verification block с цитатой вывода; «0 тестов при exit 0 — не успех»; никаких `-DskipTests` | — |
| `java-quality-gates` | «настрой проверки», «добавь ArchUnit», «гейты сборки» | ставит в проект **с одобрения пользователя**: ArchUnit `CodeRulesTest` (правила раздела 5.5) с `FreezingArchRule` для legacy, Enforcer (версии Java / Maven), отчёт JaCoCo без порога; форматтер не навязывает | `archunit-rules.md`, `legacy-baseline.md`; `assets/CodeRulesTest.java` |

**Требование R-SKILL-1.** Каждый скилл SHALL иметь ≥ 2 кейса в `evals/routing.tsv`, а
`validate-skills` SHALL падать, если кейсов меньше.

## 5. Хуки

### 5.1 Общее

Одна точка входа `hooks/java-hooks.mjs <Event> --harness claude|gigacode|codex`.

- **R-HOOK-1.** Хук SHALL определять папку проекта в порядке `CLAUDE_PROJECT_DIR` →
  `GIGACODE_PROJECT_DIR` → `QWEN_PROJECT_DIR` → `cwd` из входа.
- **R-HOOK-2.** Если в папке проекта нет `pom.xml`, хук SHALL выйти с кодом 0 без вывода.
  - S-HOOK-2a: WHEN проект без `pom.xml` (Python, пустая папка) THEN код 0, stdout пуст.
- **R-HOOK-3.** Любая внутренняя ошибка хука (битый JSON, неожиданный ввод, исключение)
  SHALL давать код 0 без блокировки (fail open) и строку в журнале состояния.
- **R-HOOK-4.** Хук SHALL нормализовать имена инструментов: запись — `write_file`,
  `edit`, `replace` (GigaCode), `Write`, `Edit`, `MultiEdit` (Claude), `apply_patch`
  (Codex: файлы из заголовков патча; Java-правила для патча — после записи, уточнено по ревью); shell — `run_shell_command`, `Bash`, `shell`, `exec_command`. Поля пути и текста читает
  терпимо: `file_path` / `path` / `absolute_path`; `content` / `new_string` / `old_string`.
- **R-HOOK-5.** Состояние сессии хранится вне репозитория:
  `<os.tmpdir()>/forbxpg-java/<hash(проект)>/<session_id>/`. В репозиторий хук ничего не
  пишет.
- **R-HOOK-6.** Время работы хука (кроме компиляции в `Stop`) SHALL быть < 300 мс на
  файл до 2 000 строк.
- Каждое сообщение хука начинается с `[forbxpg-java]`, говорит, что нарушено, как
  исправить, и даёт однострочный пример.

### 5.2 Паспорт проекта

Строится из `pom.xml` (корень и модули) регулярками, кэшируется по mtime `pom.xml`.

Поля: Maven / wrapper (`mvnw`); версия Java (`maven.compiler.release`, `java.version`,
Enforcer); версия Spring Boot (parent / BOM); Lombok; MapStruct (+ binding); Liquibase /
Flyway; H2; Testcontainers; web-стек (webmvc / webflux / Feign); плагины качества
(Checkstyle, SpotBugs, Spotless, Error Prone, ArchUnit, JaCoCo, Enforcer); модули;
Docker (существует ли `\\.\pipe\docker_engine` или `/var/run/docker.sock`); Quarkus или
Jakarta без Spring → «специфичных правил нет».

- S-PASS-1: WHEN `pom.xml` с parent `spring-boot-starter-parent` 4.1.1, Lombok, MapStruct и
  Liquibase THEN паспорт: `Maven · Java 21 · Boot 4.1 · Lombok · MapStruct · Liquibase`.
- S-PASS-2: WHEN Quarkus BOM THEN паспорт помечает «Quarkus: no specific rules».

### 5.3 PreToolUse — жёсткие правила до записи (блок, код 2)

- **R-PRE-1.** Для записи в `*.java`, `db/changelog/**` и конфиги гейтов хук SHALL
  построить итоговый текст файла (`write_file` — `content`; `edit` — текущий файл с
  заменой `old_string` → `new_string`) и сравнить нарушения итога с нарушениями текущего
  файла.
- **R-PRE-2.** Хук SHALL блокировать только **новые** нарушения, которых не было в файле до
  правки. Legacy-код правкой рядом не блокируется.
  - S-PRE-2a: WHEN в файле уже есть `@Autowired` на поле и правка меняет другой метод THEN
    код 0.
  - S-PRE-2b: WHEN правка добавляет `@Autowired private Foo foo;` THEN код 2, в stderr —
    правило и пример с `@RequiredArgsConstructor`.

Жёсткие правила Java (мало и точно, чтобы слабая модель не зациклилась на ложных
срабатываниях):

| ID | Нарушение | Условие |
|---|---|---|
| J1 | `@Autowired` на поле | вне `src/test` (уточнено при реализации: в тестах это идиома Spring) |
| J2 | `import javax.persistence.*`, `javax.validation.*`, `javax.servlet.*`, `javax.annotation.PostConstruct` | Boot ≥ 3 |
| J3 | `System.out` / `System.err` / `printStackTrace()` | `src/main` |
| J4 | `@MockBean` / `@SpyBean` | Boot ≥ 4 (удалены) |
| J5 | JUnit 4: `import org.junit.Test`, `@RunWith` | всегда |
| J6 | новый `@Disabled` | `src/test` |

Прочие жёсткие правила:

| ID | Нарушение |
|---|---|
| G1 | правка Liquibase changelog-файла из `origin/main` / `origin/master` / `main` / `master`, которая меняет или удаляет существующие строки (дописывать новые `include` и changeset-ы можно — уточнено по ревью) |
| G2 | правка **закоммиченных** (HEAD или main) конфигов гейтов: `*CodeRulesTest*.java`, `archunit_store/**`, `archunit.properties`, `checkstyle*suppress*.xml`, `spotbugs*exclude*.xml` (уточнено по ревью) |
| S1 | `git push --force` / `-f`, `git reset --hard`, `git clean -f…` |
| S2 | `mvn` / `mvnw` с `verify`, `install` или `test` и одновременно `-DskipTests`, `-Dmaven.test.skip`, `-Djacoco.skip`, `-Dcheckstyle.skip`, `-Dspotbugs.skip`, `-Denforcer.skip` |

- S-PRE-G1: WHEN changelog есть в `origin/main` и агент его правит THEN код 2: «create a
  new changeset file».
- S-PRE-S2: WHEN `mvn -q package -DskipTests` THEN код 0 (упаковка без гейта разрешена).

### 5.4 PostToolUse — мягкие правила после записи

- **R-POST-1.** После записи в `*.java` хук SHALL вернуть в
  `hookSpecificOutput.additionalContext` только **новые** мягкие нарушения этой правки
  (снимок «до» берётся из PreToolUse по `tool_use_id`).
- **R-POST-2.** Первая запись файла каждой роли за сессию SHALL добавлять 3–5 правил роли
  (≤ 120 токенов). Роль определяется по пути, имени и аннотациям: Controller, Service,
  Repository, Entity, DTO, Mapper, Config / Properties, ExceptionHandler, Test, Liquibase.
  - S-POST-2a: WHEN второй `*Controller.java` за сессию THEN правила Controller не
    повторяются.
- Без нарушений и без новой роли — пустой вывод.

Мягкие правила (v1):

| ID | Замечание |
|---|---|
| W1 | `@Data` / `@EqualsAndHashCode` / `@ToString` на `@Entity` |
| W2 | `@ManyToOne` / `@OneToOne` без `fetch = FetchType.LAZY` |
| W3 | `@Enumerated` без `EnumType.STRING` |
| W4 | `@Transactional` на `private` или `final` методе |
| W5 | пустой `catch` |
| W6 | `@SneakyThrows` |
| W7 | конкатенация в логе: `log.info("..." + x)` |
| W8 | класс `*Impl` (конвенция команды — без интерфейса) |
| W9 | в `@RestController` внедрён `*Repository` |
| W10 | новый `@Mapper` без `unmappedTargetPolicy = ReportingPolicy.ERROR` (если в проекте MapStruct) |
| W11 | `Optional` как поле или параметр |
| W12 | новый DTO-класс с `@Data` там, где подходит record |

### 5.5 Правила для `java-quality-gates` (ArchUnit)

Не хук, а тест в проекте. Включает J1–J5 и W1–W4, W9 как правила ArchUnit, плюс: контроллер
не возвращает и не принимает `@Entity`; `controller → service → repository` без обратных
зависимостей; `@ExceptionHandler` только в `@RestControllerAdvice`; сервисы не возвращают
`ResponseEntity`. Legacy замораживается через `FreezingArchRule`.

### 5.6 UserPromptSubmit — якорь (GigaCode)

- **R-ANCHOR-1.** При `--harness gigacode` хук SHALL на каждое сообщение возвращать якорь
  ≤ 60 токенов: паспорт одной строкой и три правила.
- **R-ANCHOR-2.** После `PostCompact` первое сообщение SHALL получить один раз полный блок
  (≤ 400 токенов): паспорт, ~10 главных правил, «re-read your plan and grillspec notes».
- **R-ANCHOR-3.** В Claude Code и Codex якорь по умолчанию выключен; полный блок после
  сжатия включён.

### 5.7 Stop

- **R-STOP-1.** При `context_usage` ≥ 0,70 хук SHALL один раз за сессию вернуть
  `decision: block` с просьбой записать handoff (`grillspec note handoff …`). При
  `stop_hook_active = true` не блокирует.
- **R-STOP-2.** Если сессия меняла `*.java` после последней успешной проверки, хук SHALL
  запустить `mvnw -q -o compile` (или `mvn`) в модуле изменённых файлов, таймаут 180 с.
  Блокировать — только если ошибки компиляции в файлах этой сессии. Не больше двух
  блокировок на один и тот же набор изменений, дальше — системное сообщение «не удалось
  проверить».
  - S-STOP-2a: WHEN компиляция падает в файле, который сессия не меняла THEN без блока,
    системное сообщение.

### 5.8 SessionStart и PostCompact

- SessionStart: паспорт (+ в Claude Code и Codex — содержимое роутера, если агент не
  грузит его иначе).
- PostCompact: ставит флаг для R-ANCHOR-2.

### 5.9 Настройка

Необязательный `forbxpg-java.json` в корне проекта или `~/.forbxpg-java.json`:
`anchor` (bool), `stopCompile` (bool), `contextWarnAt` (0–1), `disable` (список id правил,
добавлено по ревью). Без файла — значения по умолчанию из раздела 5. Каждое жёсткое сообщение
велит модели остановиться и спросить пользователя, а не обходить блок.

## 6. Установка

| Агент | Команда | Что подключается |
|---|---|---|
| Claude Code | `claude plugin marketplace add <repo>` → `claude plugin install forbxpg-java` или `claude --plugin-dir <путь>` | скиллы, `hooks/hooks.json` |
| GigaCode | `gigacode extensions link <путь>` → `Y` (**не** `install`: тот берёт `.claude-plugin/`) | `contextFileName` = роутер, `skills/`, `hooks` из манифеста |
| Codex | плагин `.codex-plugin/` или копирование `skills/` в `~/.agents/skills` | скиллы; хуки после `/hooks` trust |
| Любой агент Agent Skills | `npx skills add forbxpg/<repo>` | только скиллы |

В закрытом контуре обновление — заменой папки (корпоративный режим выключает `extensions update`).
Сеть не нужна.

## 7. Качество репозитория

- **R-REPO-1.** `node scripts/validate-skills.mjs`: frontmatter по спецификации Agent
  Skills и регулярке GigaCode, лимиты строк, кейсы маршрутизации, битые ссылки на
  references.
- **R-REPO-2.** `node scripts/check-tokens.mjs`: роутер ≤ 1 500, якорь ≤ 60, блок после
  сжатия ≤ 400, правила роли ≤ 120 токенов (оценка: символы / 4).
- **R-REPO-3.** `node --test`: каждое правило J*, G*, S*, W* — тест «ловит» и тест «не
  ловит»; входы трёх агентов; сценарии S-* этой спецификации.
- **R-REPO-4.** CI (GitHub Actions): Windows, Ubuntu, macOS; Node 20 и 22.
- `node scripts/eval-routing.mjs --endpoint <OpenAI-совместимый>`: маршрутизация на модели
  класса Flash. В CI не входит (нужен ключ), гоняется вручную.
- `NOTICE`: заимствования из decebals/claude-code-java (MIT), piomin/claude-ai-spring-boot
  (Apache-2.0), a-pavithraa/springboot-skills-marketplace (MIT), Jeffallan/claude-skills
  (MIT), rrezartprebreza/spring-boot-skills (MIT), Marisha-Sahay/awesome-java-agent-skills
  (MIT).

## 8. Риски и открытые вопросы

| Риск / вопрос | Что делаем |
|---|---|
| Точные имена полей `write_file` / `edit` в GigaCode не сняты пробой | R-HOOK-4 читает терпимо; при первом живом прогоне сохраняем вход в фикстуру |
| Ложные блокировки зациклят слабую модель | жёстких правил 10, тест «не ловит» на каждое, блок только новых нарушений |
| `mvn compile` в Stop медленный (замер не делался) | `-o -q`, только модуль изменённых файлов, таймаут, `stopCompile: false` |
| Регулярки вместо парсера Java дают промахи | правила подобраны под однострочные шаблоны; сложное — в ArchUnit (5.5) |
| Обязательные проверки организации (Sonar, Checkstyle-конфиг) неизвестны | `java-quality-gates` не навязывает форматтер и пороги; дополняем, когда ответ появится |
| `SessionStart` после сжатия в TUI GigaCode не проверен | переякорение идёт через `UserPromptSubmit` (R-ANCHOR-2), от SessionStart не зависит |

## 9. Допущения

| Допущение | Если неверно |
|---|---|
| Имя плагина и расширения — `forbxpg-java` | переименовать в манифестах |
| Репозиторий публичный (MIT), без данных рабочей среды; всё рабочее — в `private/` | сделать приватным, NOTICE оставить |
| Node ≥ 20 есть везде, где стоит агент | добавить `.cmd`-обёртку с понятной ошибкой |
| Якорь выключен в Claude Code и Codex | включить через `forbxpg-java.json` |
