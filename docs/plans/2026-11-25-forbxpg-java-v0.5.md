# 2026-11-25-forbxpg-java-v0.5 — plan

## Goal

A GigaCode status line built from what the hooks already know, an opt-in forbxpg look
(theme, banner, loading phrases) installed and removed cleanly, and `/java:*` commands.

## Architecture

Hooks write three more facts (`lastBuild`, `compactions`, `<tmp>/forbxpg-java/status.json`).
`hooks/lib/statusline.mjs` renders one line from stdin + those files (a pure `renderStatusLine`
plus a reader); `hooks/statusline.mjs` is the command GigaCode runs. `installer/style.mjs`
merges six `ui.*` keys into `~/.gigacode/settings.json` with a receipt of previous values;
`install.mjs --gigacode-style` drives it. Assets live in `gigacode/`; commands in
`commands/java/`.

**Spec:** docs/specs/2026-11-25-forbxpg-java-v0.5.md

## Global Constraints

- Node ≥ 20, no dependencies; `node --test` green on every commit.
- One commit per task; no AI attribution lines in commits or PRs.
- The status line never spawns a process and never exits non-zero.
- Facts the probe (spec §6) has not confirmed are read defensively: a missing stdin field
  hides its segment, never breaks the line.

## Review Focus

1. Keys of `settings.json` the installer does not own survive install and uninstall
   unchanged, including `$version` and unknown keys (3.2 pins it).
2. The status line on garbage stdin, a missing state folder or thousands of marker files
   still prints within budget (2.2 pins it).
3. The `ui.statusLine.command` path is quoted for `cmd.exe` and survives spaces (3.2).
4. `--force` still records the previous values, so `--uninstall` restores them (3.2).
5. Command files carry no `!{…}` / `{{args}}` substitutions (4.1).

## 1. State for the status line

- [x] 1.1 Hooks record lastBuild, compactions and status.json — verify: node --test passes

Covers: R-SL-4, R-SL-6, R-SL-7 · Test: scenario-first

Files: modify hooks/lib/stop.mjs, hooks/lib/session.mjs, hooks/lib/update.mjs; test tests/statusline.test.mjs

Interfaces:
- Produces: session state `lastBuild` = `{ result: 'ok'|'fail'|'unverified', at: number }`;
  session state `compactions` = number; `statusFile(cacheRoot?) -> path` and the file
  `{ installed, latest, at }` written by SessionStart whenever an install source is known.

1. Tests: Stop success → `lastBuild.result === 'ok'`; own compile error → `'fail'`;
   unverifiable / timed out → `'unverified'`; two `noteCompaction` → `compactions === 2`
   and it is not reset by recovery; SessionStart with a clone at 0.4.3 and cache 0.4.4 →
   status file `{ installed: '0.4.3', latest: '0.4.4' }`; no source → no file written.
   Run. Expected: FAIL.
2. Implement. Commit `feat(hooks): record the last build, compactions and the update status`.

## 2. Status line

- [x] 2.1 renderStatusLine — verify: node --test passes

Covers: S-SL-1a, S-SL-1b, S-SL-1c, S-SL-1d, S-SL-1f, R-SL-2, R-SL-3, R-SL-5, R-SL-10, R-SL-11 · Test: scenario-first

Files: create hooks/lib/statusline.mjs; test tests/statusline.test.mjs

Interfaces:
- Consumes: the state from 1.1.
- Produces: `renderStatusLine(input, data, { color, width, warnAt, now }) -> string` where
  `data = { passport|null, build|null, rules: string[], compactions: number, update|null }`.

1. Tests (color off unless stated): S-SL-1a exact line; 72% → `[#######---] 72% !`, 86% →
   `!!`; `build FAIL`; `build ok <1m` and `3m`; rules capped at four, newest first;
   S-SL-1d (no passport) exact line; width 60 keeps model, ctx, build only; color on →
   `!!` and `FAIL` wrapped in `\x1b[31m…\x1b[0m`, `ok` in green; empty segments leave no
   double ` ·  · `. Run. Expected: FAIL.
2. Implement. Commit `feat(statusline): render the forbxpg status line`.

- [x] 2.2 Status line command — verify: node --test passes

Covers: R-SL-1, R-SL-8, R-SL-9, S-SL-1e · Test: scenario-first

Files: create hooks/statusline.mjs; modify hooks/lib/statusline.mjs; test tests/statusline.test.mjs

Interfaces:
- Produces: `node hooks/statusline.mjs` (stdin JSON → one line, exit 0);
  `readStatusData(input, { tmpRoot, now }) -> data` for 2.1.

1. Tests (spawn the script): Maven project with state of a known `session_id` → its
   build/rules; without `session_id` → newest session folder; folder without `pom.xml` →
   model · ctx · fj only; `not json` → `?` and exit 0; 2 000 violated markers → still
   under 1 s on CI (budget 150 ms is measured by the probe, not CI). Run. Expected: FAIL.
2. Implement. Commit `feat(statusline): the status line command`.

## 3. Look and install

- [x] 3.1 Theme, banner and phrases — verify: node --test passes

Covers: R-THEME-1, R-BANNER-1, R-PHRASE-1 · Test: scenario-first

Files: create gigacode/themes/forbxpg-light.json, gigacode/themes/forbxpg-dark.json, gigacode/banner.txt, gigacode/phrases.json; test tests/style.test.mjs

1. Tests: each theme has `name`, `type: "custom"` and every required colour key as a hex;
   banner is ASCII, ≤ 6 lines, ≤ 60 columns; phrases: 20 unique non-empty strings.
   Run. Expected: FAIL.
2. Write the assets. Commit `feat(style): forbxpg themes, banner and loading phrases`.

- [x] 3.2 install.mjs --gigacode-style — verify: node --test passes

Covers: S-STYLE-1a, S-STYLE-1b, R-STYLE-1, R-STYLE-2, R-STYLE-3, R-STYLE-4, R-STYLE-5 · Test: scenario-first

Files: create installer/style.mjs; modify install.mjs; test tests/style.test.mjs

Interfaces:
- Produces: `installStyle({ repoDir, homeDir, dark, force, dryRun }) -> { written, skipped, conflicts }`,
  `uninstallStyle({ homeDir }) -> { restored, kept }`.

1. Tests with a temp home: clean settings with `$version` and an unknown key → six keys
   written, both kept, `.bak` and receipt exist, themes copied; second run → no change;
   own `ui.theme` → conflict listed, file untouched; `--force` → written and receipt holds
   the old theme; uninstall → settings deep-equal the original; a key changed by the user
   after install is kept and reported; invalid JSON → error, file untouched; `--dry-run`
   writes nothing; repo path with a space → command `node "<path>/hooks/statusline.mjs"`.
   Run. Expected: FAIL.
2. Implement. Commit `feat(install): --gigacode-style installs and removes the forbxpg look`.

- [x] 3.3 --preview — verify: node --test passes

Covers: R-STYLE-6, S-STYLE-1c · Test: scenario-first

Files: modify install.mjs, installer/style.mjs; test tests/style.test.mjs

1. Tests: `--gigacode-style --preview` prints three status lines (clean, warnings, outside
   Maven) and the banner, and changes no file in the temp home. Run. Expected: FAIL.
2. Implement. Commit `feat(install): --preview shows the status line on sample data`.

## 4. Commands

- [ ] 4.1 /java:review, /java:verify, /java:update — verify: node --test passes

Covers: S-CMD-1a, R-CMD-1, R-CMD-2, R-CMD-3 · Test: scenario-first

Files: create commands/java/review.md, commands/java/verify.md, commands/java/update.md; modify gigacode-extension.json (if the probe says a field is needed), installer/project.mjs; test tests/manifests.test.mjs, tests/installer.test.mjs

1. Tests: three files with a `description` frontmatter and no `!{` / `{{`; each names its
   skill or command; project install (gigacode and claude) copies them and uninstall
   removes them; the extension exposes them the way the probe found. Run. Expected: FAIL.
2. Write them. Commit `feat(commands): /java:review, /java:verify and /java:update`.

## 5. Docs

- [ ] 5.1 Docs and changelog — verify: links check passes and node --test passes

Covers: — · Test: none: documentation

Files: docs/{en,ru}/installation.md, docs/{en,ru}/configuration.md, docs/{en,ru}/internals/05-state-config-passport.md, CHANGELOG.md

1. Document `--gigacode-style` (and `--dark`, `--force`, `--dry-run`, `--preview`,
   `--uninstall`), the status line segments, the new state files, the commands.
   Commit `docs: the GigaCode look, status line and /java commands`.
