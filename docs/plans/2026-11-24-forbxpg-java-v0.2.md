# 2026-11-24-forbxpg-java-v0.2 — plan

## Goal

Add a design-phase skill, a user / project installer for GigaCode and Claude Code, fix the
v0.1 review minors, verify in a live Claude Code session, then publish.

## Architecture

`install.mjs` at the repository root is a thin CLI over `installer/*.mjs` (pure functions
over a target folder, tested on temp projects). Project installs copy `skills/` and
`hooks/` and merge a hooks block into the agent's `settings.json`, recording everything in a
receipt. User installs call the agents' own CLIs through an injectable runner.

**Spec:** docs/specs/2026-11-24-forbxpg-java-v0.2.md

## Global Constraints

- Node ≥ 20, no npm dependencies; `node --test` stays green on every commit.
- One commit per task, conventional message, attribution line.
- Installer never touches files it did not write (receipt), never deletes user edits
  without `--force`.

## Review Focus

1. `settings.json` with comments or trailing commas (JSONC) → refuse with a clear message,
   never overwrite (2.1 pins it).
2. Windows paths in receipts and commands → receipts store forward-slash relative paths
   (2.1 pins it).
3. Installing twice into the same project, once per agent → both coexist (2.2 pins it).

## 1. Design skill

- [x] 1.1 java-design-decisions skill — verify: node scripts/validate-skills.mjs && node scripts/check-tokens.mjs exit 0

Covers: — · Test: none: prose; structure, routing cases and budget are checked by scripts

Files: create skills/java-design-decisions/SKILL.md and references; modify
skills/using-java-best-practices/SKILL.md, evals/routing.tsv

1. Write the skill per spec R-DESIGN-1..3; three routing cases.
2. Router: table row and the design-phase rule; router stays ≤ 1 500 tokens.
3. Run both scripts. Expected: exit 0. Commit `feat(skills): java-design-decisions`.

## 2. Installer

- [x] 2.1 Project install for GigaCode — verify: node --test tests/installer.test.mjs passes

Covers: S-INST-4a, S-INST-5a · Test: scenario-first

Files: create install.mjs, installer/project.mjs, installer/settings.mjs,
installer/receipt.mjs; test tests/installer.test.mjs

Interfaces:
- Produces: `installProject({ repoDir, projectDir, agent, dryRun }) -> { written, merged, skipped }`,
  `uninstallProject({ projectDir, agent })`, `mergeHooks(settings, hooksBlock) -> settings`,
  `removeHooks(settings) -> settings` (entries whose command contains `forbxpg-java`).

1. Tests: S-INST-4a (existing `permissions` + foreign `PreToolUse` hook kept, ours once
   after two installs); S-INST-5a (install then uninstall restores the tree byte for byte,
   including `GIGACODE.md`); R-INST-7 (spawn the copied `java-hooks.mjs` with a J1 write →
   exit 2); R-INST-8 (dry run writes nothing); JSONC `settings.json` → error, file
   unchanged; receipt paths use `/`. Run. Expected: FAIL.
2. Implement. Commit `feat(installer): project install for GigaCode`.

- [ ] 2.2 Project install for Claude Code, update and force — verify: node --test tests/installer.test.mjs passes

Covers: S-INST-6a · Test: scenario-first

Files: modify installer/project.mjs, tests/installer.test.mjs

1. Tests: Claude layout (`.claude/skills`, `.claude/settings.json`, `$CLAUDE_PROJECT_DIR`
   command); GigaCode and Claude installed in one project coexist; S-INST-6a (edited skill
   kept on `--update`, replaced with `--force`); update replaces unchanged files and adds
   new ones. Run. Expected: FAIL.
2. Implement. Commit `feat(installer): project install for Claude Code, update and force`.

- [ ] 2.3 User scope through the agents' CLIs — verify: node --test tests/installer.test.mjs passes

Covers: — · Test: scenario-first

Files: create installer/user.mjs; modify install.mjs, tests/installer.test.mjs

Interfaces:
- Produces: `installUser({ repoDir, agent, uninstall }, run) -> string[]`, where
  `run(cmd, args, { input }) -> { status, output }` is injectable.

1. Tests with a fake runner: GigaCode link gets input `Y\n`; Claude runs marketplace add +
   plugin install; uninstall commands; a failing command is reported with its output.
   Run. Expected: FAIL.
2. Implement; `install.mjs --help` documents every flag. Commit
   `feat(installer): user install through gigacode and claude CLIs`.

## 3. Review minors

- [ ] 3.1 Rules M1, M2 — verify: node --test passes

Covers: — · Test: reproduce-first

Files: modify hooks/lib/rules.mjs, tests/rules.test.mjs

1. Miss cases: `class OrderRepositoryImpl implements OrderRepositoryCustom`;
   `@Entity @ToString(onlyExplicitlyIncluded = true) class O {}`. Run. Expected: FAIL.
2. Fix. Commit `fix(hooks): W8 skips Spring Data fragments, W1 allows explicit-include Lombok`.

- [ ] 3.2 Passport M3 — verify: node --test passes

Covers: — · Test: reproduce-first

Files: modify hooks/lib/passport.mjs, tests/passport.test.mjs

1. Fixtures: corporate parent + `spring-boot.version` property; corporate parent + BOM in a
   module; only `spring-boot-maven-plugin` with a version. Each → `bootMajor` 3 or 4.
   Run. Expected: FAIL.
2. Fix. Commit `fix(hooks): find the Boot version behind a corporate parent`.

- [ ] 3.3 Version-aware texts M4, M8 — verify: node --test passes

Covers: — · Test: reproduce-first

Files: modify hooks/lib/anchor-text.mjs, hooks/lib/roles.mjs, hooks/lib/post.mjs,
hooks/lib/stop.mjs, docs/{en,ru}/how-it-works.md; tests

1. Tests: Boot 3.3 recovery text says `@MockBean`, Boot 3.4+ `@MockitoBean`; Flyway project
   entity rules say Flyway; the context warning mentions the plan file fallback. Run.
   Expected: FAIL.
2. Fix (role rules become a function of the passport). Commit
   `fix(hooks): version-aware advice and a handoff fallback without grillspec`.

- [ ] 3.4 State M5 — verify: node --test passes

Covers: — · Test: reproduce-first

Files: modify hooks/lib/state.mjs, hooks/lib/post.mjs, hooks/lib/stop.mjs; tests

1. Tests: after PostToolUse the `pre-*` snapshot is gone; 20 concurrent PostToolUse calls on
   20 files leave 20 changed files. Run. Expected: FAIL.
2. Fix with marker files. Commit `fix(hooks): race-free session state and snapshot cleanup`.

- [ ] 3.5 M6, M7 — verify: node --test passes and validate-skills exits 0

Covers: — · Test: reproduce-first

Files: modify gigacode-extension.json, hooks/hooks.json, hooks/hooks-codex.json,
tests/manifests.test.mjs, skills/java-verification/SKILL.md

1. Manifest test: PostToolUse matchers contain no shell tool. Run. Expected: FAIL.
2. Fix matchers; java-verification logs to the temp folder. Commit
   `fix: post-write hooks only on file tools; build log outside the project`.

## 4. Verify and publish

- [ ] 4.1 Live Claude Code check — verify: blocks and remarks observed in a real session

Covers: — · Test: none: manual end-to-end check, recorded in the ledger

Files: none (CHANGELOG.md and version bump to 0.2.0 in the final commit)

1. `claude -p` with `--plugin-dir` on a test Maven project: J1 refused, W remark seen,
   end-of-turn compile block on a broken file.
2. Same after `node install.mjs --agent claude --scope project`.
3. Bump versions to 0.2.0, CHANGELOG; commit `chore(release): 0.2.0`.

- [ ] 4.2 GigaCode project-install probe prompt — verify: prompt file exists and is shown to the user

Covers: — · Test: none: a prompt for the work machine

Files: create a prompt in private/ (not published)

- [ ] 4.3 Publish — verify: GitHub Actions green on all three systems

Covers: — · Test: none: release step

Files: none

1. `gh repo create forbxpg/forbxpg-java-best-practices-skill --public`, push the branch and
   `main`, watch CI; fix what fails with a test first.
