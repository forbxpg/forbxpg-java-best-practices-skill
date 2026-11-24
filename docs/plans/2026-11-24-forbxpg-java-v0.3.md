# 2026-11-24-forbxpg-java-v0.3 — plan

## Goal

Make the per-prompt anchor adaptive (this session's violations, then touched roles, then
defaults), add the session's violations to the recovery block, and publish the internals
guide in English.

**Spec:** docs/specs/2026-11-24-forbxpg-java-v0.3.md

## Global Constraints

- Node ≥ 20, no npm dependencies; `node --test` stays green on every commit.
- One commit per task, conventional message, attribution line. Work on `feat/v0.3`.
- Anchor ≤ 60 tokens, recovery ≤ 500 tokens in the worst case (`check-tokens`).

## 1. Hooks

- [x] 1.1 Short texts — verify: node --test tests/rules.test.mjs tests/post.test.mjs passes

Covers: R-SHORT-1, R-SHORT-2 · Test: scenario-first

Files: modify hooks/lib/rules.mjs, hooks/lib/roles.mjs; tests

1. Tests: every RULES entry has `short` ≤ 40 chars; every role has a short text ≤ 40 chars.
   Run. Expected: FAIL.
2. Add the texts. Commit `feat(hooks): short rule and role texts for the anchor`.

- [x] 1.2 Track violations — verify: node --test passes

Covers: R-TRACK-1..3 · Test: scenario-first

Files: modify hooks/lib/state.mjs, hooks/lib/pre.mjs, hooks/lib/post.mjs; tests

Interfaces:
- Produces: `markViolated(dir, id)`, `recentViolations(dir) -> id[]` (newest first),
  `recentRoles(dir) -> role[]` (newest first).

1. Tests: a J1 block and a W1 remark are recorded, newest first; a repeated id moves to the
   front; a disabled id is not recorded; roles come newest first. Run. Expected: FAIL.
2. Implement. Commit `feat(hooks): record the rules a session broke`.

- [x] 1.3 Adaptive anchor and recovery — verify: node --test passes and check-tokens exits 0

Covers: R-ANCHOR-4..6, R-RECOVER-1..2, S-ANCHOR-4a..c, S-RECOVER-1a · Test: scenario-first

Files: modify hooks/lib/anchor-text.mjs, hooks/lib/session.mjs, scripts/check-tokens.mjs; tests

1. Tests: S-ANCHOR-4a/4b/4c, S-RECOVER-1a, recovery lists broken rules with their fix;
   check-tokens worst case uses the three longest short texts and five longest fixes.
   Run. Expected: FAIL.
2. Implement. Commit `feat(hooks): adaptive anchor and broken rules after compaction`.

## 2. Docs

- [x] 2.1 Russian internals updated — verify: link check passes

Covers: R-DOCS-2 · Test: none: prose

Files: modify docs/ru/internals/*.md, docs/ru/how-it-works.md, docs/ru/configuration.md

- [ ] 2.2 English internals — verify: link check passes and render-diagrams exits 0

Covers: R-DOCS-1 · Test: none: prose and diagrams

Files: create docs/en/internals/*.md, docs/en/internals/diagrams/*.mmd, img/*.png; modify
README.md, docs/en/how-it-works.md, docs/en/configuration.md

## 3. Release

- [ ] 3.1 0.3.0 — verify: CI green

Files: manifests, CHANGELOG.md. Commit `chore(release): 0.3.0`, push `feat/v0.3`, PR.
