# Configuration

Optional JSON file: `forbxpg-java.json` in the project root, or `~/.forbxpg-java.json` for
all projects. The project file wins key by key. Without a file, the defaults apply.

```json
{
  "anchor": null,
  "stopCompile": true,
  "contextWarnAt": 0.7,
  "disable": []
}
```

| Key | Default | Meaning |
|---|---|---|
| `anchor` | `null` → on in GigaCode, off in Claude Code and Codex | per-prompt anchor (passport + three rules) |
| `stopCompile` | `true` | compile changed modules at the end of a turn |
| `contextWarnAt` | `0.7` | context usage share at which the model is asked, once, to write a handoff note (GigaCode reports context usage) |
| `disable` | `[]` | rule ids switched off for this project, e.g. `["J3"]` for a CLI that prints to `System.out` |

Disabling is the user's decision: a blocked model is told to stop and ask, never to edit this
file itself. Changing what a rule means happens in the skill and the hooks, with tests.
