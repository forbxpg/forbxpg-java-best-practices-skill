# forbxpg-java internals

A complete description of how forbxpg-java is built and how an agent works with it:
Claude Code, GigaCode or Codex. The user documentation (how to install, how to configure)
lives one level up: [installation.md](../installation.md),
[configuration.md](../configuration.md), [how-it-works.md](../how-it-works.md).
This section covers what happens inside.

## Contents

| Document | What it covers |
|---|---|
| [01. Overview](01-overview.md) | What the repository consists of, the three defense layers, glossary |
| [02. Hooks: what they are and how they work](02-hooks-explained.md) | What a hook is, who runs it, where it is registered, how its output reaches the model, why hooks in particular |
| [03. Events in order](03-hook-events.md) | SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PostCompact, Stop: input, logic, output |
| [04. Rules](04-rules.md) | The J / G / S / W catalog, how rules are detected in code, file roles |
| [05. Passport, state, configuration](05-state-config-passport.md) | What the hook knows about the project and what it remembers between calls |
| [06. Skills and the router](06-skills.md) | How the harness finds and loads skills, why there is a router |
| [07. Installation internals](07-installation.md) | `install.mjs`: user and project scope, receipt, update, removal |
| [08. Harness differences](08-harnesses.md) | Claude Code, GigaCode, Codex: what is the same and what is not |
| [09. Development and checks](09-development.md) | Tests, scripts, CI, the gate fixture, how to add a rule |
| [10. Troubleshooting](10-troubleshooting.md) | The hook is silent, the hook gets in the way, how to run a hook by hand |

## How to read

If you need to understand **hooks**, read 02, then 03. That is the core.
If you need to **add or change a rule**, read 04 and 09.
If **something does not work**, go straight to 10.

## Diagrams

Sources are in `diagrams/*.mmd` (Mermaid), images in `img/*.png`. To re-render all of them:

```bash
node scripts/render-diagrams.mjs
```

This needs [mermaid-cli](https://github.com/mermaid-js/mermaid-cli) (`mmdc` on `PATH`). If `mmdc`
cannot find a browser, point it to an installed Chrome through a Puppeteer config:

```bash
echo '{"executablePath": "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}' > pptr.json
node scripts/render-diagrams.mjs --puppeteer-config pptr.json
```

If you change a diagram, edit the `.mmd` file and re-render the PNG in the same commit.
