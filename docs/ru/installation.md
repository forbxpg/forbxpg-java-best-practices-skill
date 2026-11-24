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
- Манифест `gigacode-extension.json` загружает роутер через `contextFileName`, девять
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
