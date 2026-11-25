# 2026-11-25-forbxpg-java-v0.4 — plan

## Goal

Tell the user, once per session, that a newer tagged version of forbxpg-java exists, and
let the agent offer the update command.

## Architecture

`hooks/lib/update.mjs` finds the install source (clone or project receipt), reads and
refreshes a per-remote cache in the temp folder, and formats the notice. `SessionStart`
appends the notice and, when the cache is stale, spawns `hooks/update-check.mjs` detached.
`install.mjs --check` runs the same check synchronously.

**Spec:** docs/specs/2026-11-25-forbxpg-java-v0.4.md

## Global Constraints

- Node ≥ 20, no dependencies; `node --test` green on every commit.
- One commit per task; no AI attribution lines in commits or the PR.
- The check never blocks a session and never prompts for credentials.

## Review Focus

1. A remote URL with credentials must never reach the receipt or a message (1.1 pins it).
2. A hung `git ls-remote` must not keep the detached process alive past the timeout (2.1).
3. Windows: the detached process starts without a console window (2.2 checks spawn options).

## 1. Source and versions

- [x] 1.1 Install source and version comparison — verify: node --test tests/update.test.mjs passes

Covers: S-NOTE-3c · Test: scenario-first

Files: create hooks/lib/update.mjs; modify installer/project.mjs; test tests/update.test.mjs

Interfaces:
- Produces: `installSource(hooksLibDir) -> { kind: 'clone'|'project', version, remote, cloneDir? } | null`;
  `latestTag(tags: string[]) -> string|null`; `newer(a, b) -> boolean`; `stripCredentials(url)`.

1. Tests: clone layout with `.git` and `origin` → `kind: 'clone'`; project layout with a
   receipt → `kind: 'project'`; neither → null (S-NOTE-3c); `latestTag(['v0.3.0','v0.10.0','v1.0.0-rc1','junk'])`
   → `0.10.0`; `stripCredentials('https://u:p@host/r.git')` → `https://host/r.git`; the
   receipt written by `installProject` has `source.remote` without credentials.
   Run. Expected: FAIL.
2. Implement. Commit `feat(update): find the install source and compare versions`.

## 2. Background check and notice

- [ ] 2.1 Cache, lock and ls-remote check — verify: node --test tests/update.test.mjs passes

Covers: — · Test: scenario-first

Files: create hooks/update-check.mjs; modify hooks/lib/update.mjs, tests/update.test.mjs

1. Tests with a temporary bare repo as remote: tags v0.3.0, v0.4.0 → cache `latest` 0.4.0;
   unreachable remote → cache `error`, no throw; a lock younger than 60 s → no second
   check; a fake `git` that sleeps 30 s → the check returns within ~6 s with `error`.
   Run. Expected: FAIL.
2. Implement. Commit `feat(update): background tag check with cache and lock`.

- [ ] 2.2 SessionStart notice — verify: node --test passes

Covers: S-NOTE-3a, S-NOTE-3b · Test: scenario-first

Files: modify hooks/lib/session.mjs, hooks/lib/config.mjs; tests

1. Tests: installed 0.3.0 + cache 0.4.0 → SessionStart output contains
   `Update available: 0.3.0 → 0.4.0` and the clone command; GigaCode output also carries
   the text for the user (systemMessage); equal or older → nothing; `updateCheck: false`
   → nothing and no spawn; stale cache → spawn called with `windowsHide` and `detached`.
   Run. Expected: FAIL.
2. Implement. Commit `feat(update): tell the model and the user about a newer version at session start`.

## 3. Manual check, releases, docs

- [ ] 3.1 install.mjs --check — verify: node --test passes

Covers: — · Test: scenario-first

Files: modify install.mjs; tests/installer.test.mjs

1. Test: `--check` against a temp remote prints installed and latest. Run. Expected: FAIL.
2. Implement. Commit `feat(install): --check prints the installed and the latest version`.

- [ ] 3.2 Tags and docs — verify: git ls-remote --tags origin lists v0.1.0, v0.2.0, v0.3.0

Covers: — · Test: none: release tags and documentation

Files: docs/{en,ru}/configuration.md, docs/{en,ru}/installation.md,
docs/{en,ru}/internals/09-development.md, CHANGELOG.md

1. Tag the release commits (v0.1.0 = d4ed303, v0.2.0 = 3aadd9b, v0.3.0 = d3cc184) and push
   the tags.
2. Docs: `updateCheck`, `--check`, the notice, tagging rule, Bitbucket mirrors must carry
   tags. Commit `docs: update notice, --check and release tags`.
3. Open the PR (no attribution), watch CI.
