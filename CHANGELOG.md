# Changelog

## Unreleased

- The update notice also comes in a session opened outside a Maven project (for example in
  a general work folder). Everything else still stays silent there: no passport, no rules.

## 0.4.1 — 2026-11-25

- Update notice, after review: commands for the model are in backticks and runnable as
  written; a clone path with shell characters is never quoted into one; the receipt's
  version, agent and remote are trusted only in plain forms (no `--upload-pack=…`, `ext::`,
  no newlines), and `git ls-remote` gets `--` before the remote; passwords are cut from
  ssh and git URLs too; a background check that fails to start no longer crashes
  SessionStart; the notice is not repeated on resume, after compaction or on a repeated
  startup of the same session.
- Second review round: an ssh host or user starting with `-` is refused; credentials in a
  receipt remote are cut before git sees them; `--check` prints the pull command only for a
  safe path; a background check that fails to start is written to `hook.log`.

## 0.4.0 — 2026-11-25

- Update notice: once a day, in the background, the hooks compare the installed version with
  the newest `vX.Y.Z` tag on the remote the skill was installed from and tell the user (and the
  model, with the update command it may run only after the user's yes) at session start.
  `updateCheck: false` or `FORBXPG_JAVA_UPDATE_CHECK=0` switches it off.
- `install.mjs --check`; project installs record `source.remote` (without credentials) in
  their receipt.
- Release tags `v0.1.0`, `v0.2.0`, `v0.3.0`.
- Stop: a module missing from the root pom's `<modules>` is reported as "could not verify",
  not as a failure in files the session did not change.
- Installer on Windows: the `cmd.exe` line is wrapped once (a command path with spaces
  survives `/s`), and an argument containing `%` is refused instead of being expanded.
- A Codex patch that touches two Maven projects is checked against each project's own root,
  so a committed gate file in the second project is still blocked (G2).
- W1 reports `@Data` (and an unrestricted `@EqualsAndHashCode`) even when a safe
  `@ToString(onlyExplicitlyIncluded = true)` is on the same line, and accepts that flag
  when its arguments continue on the next line.
- Project uninstall honours `--dry-run`, validates `settings.json` before deleting files,
  and leaves a router import that was already in `GIGACODE.md`.
- Hook ownership matches `forbxpg-java/hooks/java-hooks.mjs`, not the substring `forbxpg-java`.
- Windows install and diagram rendering quote arguments, so a repository path with spaces
  stays one argument.
- The passport cache notices a module `pom.xml` change. A failed session-state write no
  longer turns a block into a silent allow, and one broken marker no longer hides the others.
- `java-verification` uses a per-run build log instead of a shared `build.log`.
- Stop compiles every Maven project a patch changed. A successful compile of the first
  project no longer marks files in a second project as verified.
- A compaction that arrives while recovery is being returned keeps its own generation,
  so the next prompt still gets the recovery block.

## 0.3.0 — 2026-11-24

- Adaptive anchor: the three rules after the passport are the rules the model broke in
  this session (newest first, three latest distinct ones), then the rules of the file roles
  it touched, then the defaults. Same default as before: on in GigaCode, off in Claude Code
  and Codex.
- Every rule and role has a short text (≤ 40 characters) for the anchor.
- The recovery block after compaction lists up to five rules broken in this session with
  their fix; its budget is 500 tokens.
- Docs: `docs/en/internals`, the full internals guide in English with English diagrams.

## 0.2.0 — 2026-11-24

- New skill `java-design-decisions`: the API, data, integration, transaction, testing and
  rollout decisions to settle before code, with the project's default answers. Ten skills.
- Installer `install.mjs`: `--agent gigacode|claude --scope user|project`, `--update` (keeps
  files the team edited), `--force`, `--uninstall` (removes exactly what the receipt lists and
  restores `settings.json` and `GIGACODE.md`), `--dry-run`.
- Hooks find the Maven project above the written file or the session folder, and in the only
  child folder with a `pom.xml`: sessions opened in `src/`, in a module or at a git root above
  `backend/` are checked too.
- Passport finds the Boot version behind a corporate parent or an aggregator root.
- Version-aware advice: `@MockBean` before Boot 3.4, Flyway wording in Flyway projects; the
  context warning offers a plan-file handoff without grillspec.
- Fewer false positives: W8 skips Spring Data `*RepositoryImpl` fragments, W1 allows
  `onlyExplicitlyIncluded = true`.
- Race-free session state (marker files), `pre-*` snapshots removed after use; post-write
  hooks only on file tools; `java-verification` writes its build log to the temp folder.
- Uninstall ignores the `"$version"` key GigaCode adds to `settings.json`.
- Docs: installer guides, a "how the skills work" overview, and `docs/ru/internals` — hooks,
  events, rules, state, skills, installer and harness differences with diagrams.

## 0.1.0 — 2026-11-24

First release.

- Nine skills: `using-java-best-practices` (router), `java-conventions`, `java-language`,
  `spring-boot-service`, `spring-data-jpa`, `java-testing`, `java-code-review`,
  `java-verification`, `java-quality-gates`.
- Node hooks for Claude Code, GigaCode and Codex: project passport, per-prompt anchor
  (GigaCode), hard rules blocked before a write (J1–J6, G1–G2, S1–S2; on Codex Java rules
  are reported after the patch), soft findings and role rules after a write (W1–W12),
  `disable` list in `forbxpg-java.json`, recovery block after compaction, end-of-turn compile
  and context warning.
- ArchUnit `CodeRulesTest` with 13 rules and a fixture project that plants one violation
  per rule.
- Scripts: skill validator, token budget check, routing eval against an OpenAI-compatible
  endpoint.
