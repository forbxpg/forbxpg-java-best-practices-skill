# forbxpg-java изнутри

Полное описание того, как устроен forbxpg-java и как с ним работает агент:
Claude Code, GigaCode или Codex. Пользовательская документация (как поставить,
как настроить) лежит уровнем выше: [installation.md](../installation.md),
[configuration.md](../configuration.md), [how-it-works.md](../how-it-works.md).
Здесь — что происходит внутри.

## Оглавление

| Документ | О чём |
|---|---|
| [01. Обзор](01-overview.md) | Из чего состоит репозиторий, три слоя защиты, словарь |
| [02. Хуки: что это и как работают](02-hooks-explained.md) | Что такое хук, кто его запускает, где он записан, как его вывод доходит до модели, почему именно хуки |
| [03. События по порядку](03-hook-events.md) | SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PostCompact, Stop: вход, логика, выход |
| [04. Правила](04-rules.md) | Каталог J / G / S / W, как они ищутся в коде, роли файлов |
| [05. Паспорт, состояние, настройки](05-state-config-passport.md) | Что хук знает о проекте и что помнит между вызовами |
| [06. Скиллы и роутер](06-skills.md) | Как харнесс находит и подгружает скиллы, зачем роутер |
| [07. Установка изнутри](07-installation.md) | `install.mjs`: user и project, квитанция, обновление, удаление |
| [08. Различия харнессов](08-harnesses.md) | Claude Code, GigaCode, Codex: что одинаково, что нет |
| [09. Разработка и проверки](09-development.md) | Тесты, скрипты, CI, гейт-фикстура, как добавить правило |
| [10. Диагностика](10-troubleshooting.md) | Хук молчит, хук мешает, как запустить хук руками |

## Как читать

Если нужно понять **хуки** — читайте 02, потом 03. Это ядро.
Если нужно **добавить или поменять правило** — 04 и 09.
Если **что-то не работает** — сразу 10.

## Диаграммы

Исходники — `diagrams/*.mmd` (Mermaid), картинки — `img/*.png`. Перерисовать все:

```bash
node scripts/render-diagrams.mjs
```

Нужен [mermaid-cli](https://github.com/mermaid-js/mermaid-cli) (`mmdc` в `PATH`). Если `mmdc`
не находит браузер, укажите установленный Chrome через конфиг Puppeteer:

```bash
echo '{"executablePath": "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}' > pptr.json
node scripts/render-diagrams.mjs --puppeteer-config pptr.json
```

Правите схему — правьте `.mmd` и перерисовывайте PNG в том же коммите.
