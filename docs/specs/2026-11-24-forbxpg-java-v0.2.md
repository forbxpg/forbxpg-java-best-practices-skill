# Спецификация: forbxpg-java v0.2

Статус: **черновик, ждёт одобрения**. Дата: 24.11.2026. Продолжает
[спецификацию v0.1](2026-11-24-forbxpg-java-skill.md).

## Решения гриля (24.11.2026)

1. Каталога скиллов пока нет: Java-скилл и grillspec — отдельные репозитории без связи
   друг с другом. Они работают рядом, каждый своими хуками и скиллами.
2. В v0.2 входит: скилл для этапа проектирования, установщик, отложенные мелочи ревью,
   живая проверка в Claude CLI.
3. Установка в проект — **копия** файлов в репозиторий, коммитится вместе с кодом.
4. Установщик — `node install.mjs` в этом репозитории, без npm и без сети.
5. Установка в проект — для GigaCode и Claude Code.
6. Исследовательские материалы не публикуются (`private/`).
7. После доработки — публичный GitHub `forbxpg/forbxpg-java-best-practices-skill`, push, CI.

## 1. Скилл `java-design-decisions`

Связывает проектирование (гриль grillspec или любой другой) с Java-знаниями без
зависимости от grillspec: модель открывает его сама по описанию.

- **R-DESIGN-1.** Описание SHALL совпадать с проектированием Java-изменения: «Use when
  planning, grilling, designing or writing a spec or plan for a change in a Java / Spring
  Boot project…». В `evals/routing.tsv` — ≥ 3 кейса, в том числе «let's grill the order
  cancellation feature» и «write the spec for the payments client».
- **R-DESIGN-2.** Содержание: решения, которые надо выяснить, по группам — API (эндпоинты,
  версия, формат ошибок, обратная совместимость), данные (сущности, changeset-ы, стратегия
  миграции, блокировки), интеграции (клиенты, таймауты, ретраи, идемпотентность),
  транзакции и асинхронность, тесты (слайс или `*IT`, H2 или Testcontainers), отклонения от
  конвенций, затронутые гейты, выкатка (совместимость, флаги). Для каждого — значение по
  умолчанию из паспорта или конвенций и когда спрашивать пользователя.
- **R-DESIGN-3.** Итог скилла — список решений в форме, пригодной для спецификации; в
  проектах с grillspec — для журнала решений гриля.
- В роутере — строка в таблице «какой скилл когда» и правило «на этапе проектирования
  Java-изменения загрузи `java-design-decisions`».

## 2. Установщик `install.mjs`

```
node install.mjs --agent gigacode|claude --scope user|project [--project <dir>]
                 [--update | --uninstall] [--dry-run] [--force]
```

- **R-INST-1 (user, GigaCode).** Запускает `gigacode extensions link <репо>` и отвечает `Y`;
  `--uninstall` — `gigacode extensions uninstall forbxpg-java`.
- **R-INST-2 (user, Claude Code).** `claude plugin marketplace add <репо>` и
  `claude plugin install forbxpg-java@forbxpg-java`; `--uninstall` — `claude plugin uninstall`.
- **R-INST-3 (project).** Копирует в проект:

  | | GigaCode | Claude Code |
  |---|---|---|
  | скиллы | `.gigacode/skills/<9 + 1>` | `.claude/skills/<9 + 1>` |
  | хуки | `.gigacode/forbxpg-java/hooks/**` | `.claude/forbxpg-java/hooks/**` |
  | регистрация хуков | блок `hooks` в `.gigacode/settings.json` (слияние) | блок `hooks` в `.claude/settings.json` (слияние) |
  | роутер | строка `@.gigacode/skills/using-java-best-practices/SKILL.md` в `GIGACODE.md` | печатает SessionStart-хук |
  | квитанция | `.gigacode/forbxpg-java/install-receipt.json` | `.claude/forbxpg-java/install-receipt.json` |

  Команды хуков: GigaCode — `node .gigacode/forbxpg-java/hooks/java-hooks.mjs <Event> --harness gigacode`
  (путь от корня проекта); Claude Code — `node "$CLAUDE_PROJECT_DIR/.claude/forbxpg-java/hooks/java-hooks.mjs" <Event> --harness claude`.
- **R-INST-4.** Слияние `settings.json` сохраняет все чужие ключи и хуки; свои записи
  узнаёт по `forbxpg-java` в команде. Повторная установка ничего не дублирует.
  - S-INST-4a: WHEN в `settings.json` уже есть `permissions` и чужой хук `PreToolUse` THEN
    после установки оба на месте, наш хук добавлен один раз.
- **R-INST-5.** Квитанция хранит версию, список файлов с sha256 и добавленные записи.
  `--uninstall` удаляет ровно их (и строку импорта в `GIGACODE.md`).
  - S-INST-5a: WHEN установка, затем удаление THEN проект совпадает с исходным.
- **R-INST-6.** `--update` заменяет файлы из квитанции; файл, изменённый в проекте (sha256
  не совпадает), пропускается с предупреждением, без `--force`.
  - S-INST-6a: WHEN пользователь правил `java-conventions/SKILL.md` THEN `--update` его не
    трогает и называет в выводе.
- **R-INST-7.** Скопированный хук работает из проекта: тестовый вызов с нарушением J1 даёт
  exit 2.
- **R-INST-8.** `--dry-run` печатает план изменений и ничего не пишет.

## 3. Мелочи из ревью v0.1

| ID | Исправление |
|---|---|
| M1 | W8 не срабатывает на `*RepositoryImpl` (фрагменты Spring Data) |
| M2 | W1 не срабатывает на `@ToString` / `@EqualsAndHashCode(onlyExplicitlyIncluded = true)` |
| M3 | Паспорт находит версию Boot и при корпоративном parent: свойства `spring-boot.version` / `spring.boot.version`, BOM в `dependencyManagement` любого pom, версия `spring-boot-maven-plugin` |
| M4 | Советы учитывают версию: `@MockitoBean` с Boot 3.4, раньше — `@MockBean`; Liquibase / Flyway — по паспорту |
| M5 | Состояние: снимок `pre-*` удаляется после PostToolUse; `changedFiles` и `rolesSeen` — файлы-маркеры вместо общего списка (параллельные вызовы ничего не теряют) |
| M6 | `java-verification` пишет лог сборки во временную папку, не в корень проекта |
| M7 | PostToolUse не подписан на shell-инструменты |
| M8 | Предупреждение о контексте: в документации — только GigaCode; в сообщении — «если установлен grillspec, …, иначе запиши handoff в файл плана» |

Остаётся как есть (соответствует S-STOP-2a): ошибка компиляции только в файлах, которые
сессия не трогала, уходит пользователю, а не модели — блок по чужим файлам зациклил бы
модель на сломанной до неё сборке.

## 4. Проверка

- `node --test`, `validate-skills`, `check-tokens` — зелёные.
- Живая сессия Claude Code с плагином на тестовом Maven-проекте: блок J1, замечание W,
  блок компиляции в конце хода; затем то же после `install.mjs --scope project`.
- Промпт пробы установки в проект для GigaCode на рабочей машине: из какой папки
  запускается хук, как выглядит одобрение хуков проекта, видит ли GigaCode
  `.gigacode/skills`.
- После пуша — CI на Windows, Linux, macOS.
