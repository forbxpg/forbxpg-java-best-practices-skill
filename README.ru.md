# forbxpg-java

Best practices Java / Spring Boot для агентов — **девять Agent Skills и хуки, которые
держат правила, даже когда модель их забыла.**

Claude Code · GigaCode · Codex — Windows, Linux, macOS — нужен только Node ≥ 20.

[English](README.md) · [Установка](docs/ru/installation.md) ·
[Как это работает](docs/ru/how-it-works.md) · [Настройка](docs/ru/configuration.md)

## Зачем

Правило в тексте — совет. Модель в длинной сессии, после автосжатия контекста или просто
со слабым вниманием его теряет. forbxpg-java ставит правило рядом с действием:

- **до записи** хук блокирует новое нарушение жёсткого правила и говорит, как исправить;
- **после записи** модель получает мягкие замечания по этой правке и правила для роли
  файла (контроллер, сущность, маппер…);
- **в конце хода** хук компилирует изменённое и останавливает модель на её собственных
  ошибках компиляции;
- **после сжатия контекста** главные правила возвращаются один раз.

Правила взяты из Maven / Spring Boot 4 проектов команды (Lombok, MapStruct, Liquibase,
пакеты по слоям) и из разбора десяти публичных коллекций Java-скиллов.

## Скиллы

| Скилл | О чём |
|---|---|
| `using-java-best-practices` | всегда загружен: паспорт проекта, 13 главных правил, какой скилл когда |
| `java-conventions` | раскладка, пакеты, именование, Lombok по ролям, DTO-records, MapStruct, конфигурация |
| `java-language` | современная Java 21 / 25: records, sealed, patterns, исключения, конкурентность |
| `spring-boot-service` | контроллеры, валидация, ProblemDetail, транзакции и прокси, HTTP-клиенты, `@Async` / `@Scheduled`, Boot 3 и 4 |
| `spring-data-jpa` | сущности, репозитории, N+1, блокировки, Liquibase |
| `java-testing` | JUnit 5, AssertJ, Mockito, слайсы на H2, Testcontainers при Docker |
| `java-code-review` | ревью по областям: корректность, конкурентность, производительность, безопасность, API, тесты |
| `java-verification` | правильная команда `mvn` и Verification block перед «готово» |
| `java-quality-gates` | ArchUnit `CodeRulesTest` (13 правил), заморозка legacy, Enforcer, JaCoCo |

## Хуки

| Когда | Что |
|---|---|
| Старт сессии | паспорт: `Maven · Java 21 · Boot 4.1 · Lombok · MapStruct · Liquibase` |
| Каждое сообщение (GigaCode) | якорь ≤ 60 токенов: паспорт и три правила |
| До записи | блок **новых** J1–J6 (`@Autowired` на поле, `javax.*` на Boot 3+, `System.out`, `@MockBean` на Boot 4, JUnit 4, новый `@Disabled`), G1–G2 (применённый changeset, конфиги гейтов), S1–S2 (`push --force`, `reset --hard`, `clean -f`, гейты с `-DskipTests`) |
| После записи | новые W1–W12 (`@Data` на `@Entity`, EAGER `@ManyToOne`, enum по порядку, `*Impl`, конкатенация в логе…) + правила роли раз за сессию |
| После сжатия | паспорт, десять главных правил, «перечитай план» — один раз |
| Конец хода | компиляция изменённых модулей (`-o -q`), блок только на ошибках в своих файлах, не больше двух раз; один раз предупреждение при 70 % контекста |

Блокируются только нарушения, которые **внесла правка**: legacy-код не мешает.

## Установка

```bash
# Claude Code
claude plugin marketplace add forbxpg/forbxpg-java-best-practices-skill
claude plugin install forbxpg-java

# GigaCode (локальная папка; ответить Y)
gigacode extensions link /путь/к/forbxpg-java-best-practices-skill

# Любой агент со Agent Skills (только скиллы, без хуков)
npx skills add forbxpg/forbxpg-java-best-practices-skill
```

Codex и подробности: [docs/ru/installation.md](docs/ru/installation.md).

## Разработка

```bash
node --test                       # хуки и скрипты, 100+ тестов
node scripts/validate-skills.mjs   # спецификация Agent Skills, имя для GigaCode, размеры, кейсы маршрутизации
node scripts/check-tokens.mjs      # бюджет постоянного контекста
ROUTING_API_KEY=... node scripts/eval-routing.mjs --endpoint <url> --model <id>
```

`tests/fixtures/gates-project` содержит по одному нарушению на каждое ArchUnit-правило:
`mvn -B -ntp test` там должен упасть ровно с 13 ошибками.

## Лицензия

MIT. Идеи и часть текста взяты из проектов под MIT / Apache-2.0 — см. [NOTICE](NOTICE).
