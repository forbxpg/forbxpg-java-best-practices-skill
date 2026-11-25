# Установка

Нужно: Node ≥ 20 в `PATH` (хуки), Maven или Maven wrapper в проекте (компиляция в конце
хода). После того как папка на машине, сеть не нужна.

## Claude Code

```bash
claude plugin marketplace add forbxpg/forbxpg-java-best-practices-skill
claude plugin install forbxpg-java
```

Для локальной копии: `claude --plugin-dir /путь/к/forbxpg-java-best-practices-skill`.
Хуки берутся из `hooks/hooks.json`, роутер печатается при старте сессии.

## GigaCode

```bash
gigacode extensions link /путь/к/forbxpg-java-best-practices-skill
```

- Ответить `Y`. В неинтерактивной оболочке `link` без ответа выходит с кодом 0 и ничего
  не ставит: `echo Y| gigacode extensions link <путь>`.
- Именно `link`, не `install`: `install` видит `.claude-plugin/` и ставит папку как
  плагин Claude, теряя контекст-файл и хуки.
- Манифест `gigacode-extension.json` загружает роутер через `contextFileName`, десять
  скиллов из `skills/` и хуки. Хуков в манифесте расширения нет в документации GigaCode,
  но они работают (проверено на GigaCode 26.11.141).
- Хуки включены по умолчанию; `"disableAllHooks": true` в `~/.gigacode/settings.json`
  их выключает.
- Хуки читаются при старте сессии: после `link` откройте новую сессию.
- Обновление — заменить содержимое папки (`git pull` или новый релиз). Удаление:
  `gigacode extensions uninstall forbxpg-java`.

## Codex

Репозиторий — плагин Codex (`.codex-plugin/plugin.json`, хуки в `hooks/hooks-codex.json`).
Codex запускает хуки плагина только после доверия в `/hooks`. Только скиллы: скопировать
`skills/*` в `~/.agents/skills/`.

Codex правит файлы через `apply_patch`, поэтому до записи работают только охрана файлов
(G1, G2) и команд (S1, S2); нарушения Java-правил, внесённые патчем, приходят сразу после
него (без блокировки). Вживую в Codex ещё не проверялось.

## Только скиллы (любой агент)

```bash
npx skills add forbxpg/forbxpg-java-best-practices-skill
```

Без хуков правила есть, но их никто не проверяет.

## Проверка

В Maven-проекте попросите агента добавить в сервис поле с `@Autowired`. Запись должна
быть отклонена сообщением `[forbxpg-java] J1:` с упоминанием `@RequiredArgsConstructor`.

## Обновления

Раз в сутки, в фоне, хук старта сессии выполняет `git ls-remote --tags` по remote, откуда
установлен скилл (`origin` клона или `source.remote` из квитанции установки в проект), и
кэширует наибольший тег `vX.Y.Z`. Если он новее установленной версии, следующая сессия
начинается с одной строки для вас и, для модели, с командой обновления: выполнить её модель
может только после вашего «да».

- Нет сети, Bitbucket просит пароль или таймаут (5 с) → тишина, повтор через сутки.
  Учётные данные не сохраняются: пароль в адресе remote (`https://user:password@`,
  `ssh://git:password@`) записывается без него.
- Квитанция лежит в git, поэтому хук верит в ней только простым значениям: версии `X.Y.Z`,
  агенту `gigacode` или `claude` и remote в виде URL, `user@host:path` или абсолютного пути.
  Остальное (опция вроде `--upload-pack=…`, `ext::`) → проверки нет.
- Уведомление приходит в новом разговоре, не при resume и не после сжатия.
- Уведомление приходит в любой папке, в том числе вне Maven-проекта.
- Проверить сейчас: `node install.mjs --check`.
- Выключить: `"updateCheck": false` в `forbxpg-java.json` или `FORBXPG_JAVA_UPDATE_CHECK=0`.
- Установки из маркетплейса Claude Code и из zip не проверяются.
- Зеркало на внутреннем Bitbucket должно зеркалировать и теги, иначе сравнивать не с чем.

## Установка в проект (для команды)

`node install.mjs --agent gigacode|claude --scope project --project <репо>` копирует скиллы
и хуки в репозиторий и регистрирует хуки в его настройках:

| | GigaCode | Claude Code |
|---|---|---|
| скиллы | `.gigacode/skills/` | `.claude/skills/` |
| хуки | `.gigacode/forbxpg-java/hooks/` | `.claude/forbxpg-java/hooks/` |
| регистрация | слияние в `.gigacode/settings.json` | слияние в `.claude/settings.json` |
| роутер | строка `@`-импорта в `GIGACODE.md` | печатает SessionStart-хук |

- Чужие ключи настроек и хуки других инструментов сохраняются; установка пишет квитанцию
  (`install-receipt.json`) со всеми файлами и их sha256.
- `--update` заменяет только файлы, которые в проекте никто не менял; изменённые
  перечисляются и остаются (`--force` заменяет и их). `--uninstall` удаляет ровно то, что
  в квитанции, и восстанавливает `settings.json` и `GIGACODE.md`.
- `settings.json` с комментариями не перезаписывается — установка откажет.
- Результат коммитится. Каждый разработчик один раз одобряет хуки проекта, когда агент спросит.
- GigaCode запускает хук по пути от корня проекта: открывайте сессии в корне.
