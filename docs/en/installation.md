# Installation

Requirements: Node ≥ 20 on `PATH` (hooks), Maven or a Maven wrapper in the project (the
end-of-turn compile). No network access is needed after the folder is on the machine.

## Claude Code

```bash
claude plugin marketplace add forbxpg/forbxpg-java-best-practices-skill
claude plugin install forbxpg-java
```

Or for a local checkout: `claude --plugin-dir /path/to/forbxpg-java-best-practices-skill`.
Hooks come from `hooks/hooks.json`; the router is printed at session start.

## GigaCode

```bash
gigacode extensions link /path/to/forbxpg-java-best-practices-skill
```

- Answer `Y`. In a non-interactive shell, `link` without an answer exits 0 and installs
  nothing: use `echo Y| gigacode extensions link <path>`.
- Use `link`, not `install`: `install` sees `.claude-plugin/` and installs the folder as a
  Claude plugin, losing the context file and the hooks.
- The manifest `gigacode-extension.json` loads the router through `contextFileName`, the
  nine skills from `skills/`, and the hooks. Hooks in the extension manifest are not in
  GigaCode's documentation but work (verified on GigaCode 26.11.141).
- Hooks are on by default; `"disableAllHooks": true` in `~/.gigacode/settings.json`
  turns them off.
- Hooks are read at session start: open a new session after linking.
- Update: replace the folder contents (`git pull` or unpack a release). Remove:
  `gigacode extensions uninstall forbxpg-java`.

## Codex

The repository is a Codex plugin (`.codex-plugin/plugin.json`, hooks in
`hooks/hooks-codex.json`). Codex runs plugin hooks only after you trust them with
`/hooks`. Skills only: copy `skills/*` to `~/.agents/skills/`.

Codex edits files with `apply_patch`, so before the write only the file guards (G1, G2) and
the shell guards (S1, S2) apply; Java rule violations a patch introduces are reported right
after it (not blocked). Codex support has not been tried in a live session yet.

## Skills only (any agent)

```bash
npx skills add forbxpg/forbxpg-java-best-practices-skill
```

Without hooks you get the rules, but nothing enforces them.

## Check that it works

In a Maven project, ask the agent to add a field with `@Autowired` to a service. The write
must be refused with a `[forbxpg-java] J1:` message that names `@RequiredArgsConstructor`.

## Project install (team setup)

`node install.mjs --agent gigacode|claude --scope project --project <repo>` copies the skills
and the hooks into the repository and registers the hooks in its settings:

| | GigaCode | Claude Code |
|---|---|---|
| skills | `.gigacode/skills/` | `.claude/skills/` |
| hooks | `.gigacode/forbxpg-java/hooks/` | `.claude/forbxpg-java/hooks/` |
| registration | merged into `.gigacode/settings.json` | merged into `.claude/settings.json` |
| router | `@` import line in `GIGACODE.md` | printed by the SessionStart hook |

- Existing settings keys and other tools' hooks are kept; the install writes a receipt
  (`install-receipt.json`) with every file and its sha256.
- `--update` replaces only files nobody changed in the project; changed ones are listed and
  kept (`--force` replaces them). `--uninstall` removes exactly what the receipt lists and
  restores `settings.json` and `GIGACODE.md`.
- `settings.json` with comments is refused, not rewritten.
- Commit the result. Each developer approves the project hooks once when the agent asks.
- GigaCode runs the hook with a path relative to the project root: open sessions in the
  project root.
