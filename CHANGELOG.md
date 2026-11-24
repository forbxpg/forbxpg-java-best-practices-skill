# Changelog

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
