# 08. Harness differences

There is one hook codebase. The differences are in how a harness registers the hooks, what
it sends to them and what it does with the response. The `--harness` flag tells the code
where to account for these differences.

| | Claude Code | GigaCode | Codex |
|---|---|---|---|
| Packaging | plugin (`.claude-plugin/`) | extension (`gigacode-extension.json`) | plugin (`.codex-plugin/`) |
| Hook registration | `hooks/hooks.json` | `hooks` key in the extension manifest | `hooks/hooks-codex.json` |
| Hook path in the command | `${CLAUDE_PLUGIN_ROOT}` | `${extensionPath}${/}` | `${PLUGIN_ROOT}` |
| Timeout unit | seconds | milliseconds | seconds |
| How the router gets into context | `SessionStart` output | `contextFileName` / `GIGACODE.md` | `SessionStart` output |
| Write tools | `Write`, `Edit`, `MultiEdit` | `write_file`, `edit`, `replace` | `apply_patch` (+ `Edit`, `Write`) |
| Shell | `Bash` | `run_shell_command` | `Bash`, `exec_command` (command as an array) |
| Java rules block before the write | yes | yes | no: the resulting text is not visible from the patch, violations are reported after it |
| Compaction event | `SessionStart` with `source: compact` | `PostCompact` | `SessionStart` with `source: compact` |
| `context_usage` in `Stop` | no | yes | no |
| Anchor by default | off | on | off |
| Hook approval | plugin: at install; project: trusted folder | on by default, `disableAllHooks` turns them off | trust in `/hooks` |
| Verified live | yes (CLI 2.1.287) | yes (26.11.141) | no |

## The anchor is on by default only in GigaCode

This is set by specification v0.1 (R-ANCHOR-3): GigaCode is the main working environment,
where the anchor is needed; in Claude Code and Codex it is off by default, while the
recovery block after compaction works everywhere. This is only the default: the `anchor`
key in `forbxpg-java.json` turns the anchor on or off in any harness. Since v0.3 the anchor
is adaptive: its rules are taken from the violations and file roles of the current session
([03](03-hook-events.md#userpromptsubmit-anchor-and-recovery)).

## Why GigaCode gets the router without a hook

With `contextFileName`, GigaCode puts the file into the context itself and manages it during
compaction. Printing the same text from the `SessionStart` hook would produce two copies of
the router.

## Project folder environment variables

The hook takes the session folder from the first non-empty one of: `CLAUDE_PROJECT_DIR`,
`GIGACODE_PROJECT_DIR`, `QWEN_PROJECT_DIR`, then `cwd` from the hook input, then the
process's current folder. From there it searches for the Maven project root
([02](02-hooks-explained.md#how-the-hook-finds-the-project)).

## Windows

- Hooks run as `node ...` from `cmd`: neither bash nor PowerShell is needed.
- Paths with `\` are normalised; file paths are compared with compiler error paths
  case-insensitively and through the real path.
- Compilation: `mvnw.cmd` runs through the shell, and on timeout `taskkill /T /F` kills the
  whole `cmd → mvn → java` tree.
- CI runs all tests on Windows, Linux and macOS with Node 20 and 22.

Next: [09. Development and checks](09-development.md).
