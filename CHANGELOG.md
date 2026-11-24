# Changelog

## Unreleased

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
