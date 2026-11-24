# 09. Development and checks

## Commands

```bash
node --test                          # 150+ tests: hooks, installer, scripts, manifests
node scripts/validate-skills.mjs      # skills: frontmatter, names, sizes, links, routing cases
node scripts/check-tokens.mjs         # budget of the permanent context
node scripts/render-diagrams.mjs      # re-render PNGs from docs/*/internals/diagrams
ROUTING_API_KEY=... node scripts/eval-routing.mjs --endpoint <url> --model <id>
```

There are no dependencies: `node --test` is Node's built-in test runner.

## Tests

| File | What it checks |
|---|---|
| `entry.test.mjs` | the entry point: not a Maven project, broken JSON, unknown event |
| `io.test.mjs` | the session folder, `normalizeTool` for the three harnesses, state, settings |
| `root.test.mjs` | finding the Maven root: `src/`, a module, a git root above `backend/`, two subfolders |
| `rules.test.mjs` | every rule catches what it should and does not catch what it should not, message text |
| `pre.test.mjs` | `PreToolUse`: blocking new violations, legacy does not interfere, G1, G2, S1, S2 |
| `post.test.mjs` | `PostToolUse`: remarks, role rules only once |
| `session.test.mjs` | passport, anchor, recovery after compaction |
| `anchor.test.mjs` | short texts, tracking of violations and roles, adaptive anchor, violations in the recovery block, budgets |
| `stop.test.mjs` | context warning, compilation, the session's own and other errors, block limit, offline, `stopCompile` |
| `passport.test.mjs` | the passport from the `tests/fixtures/poms/` fixtures |
| `version-aware.test.mjs` | advice that depends on the Boot version and the migration tool |
| `state-race.test.mjs` | 20 parallel processes do not lose marks |
| `review-fixes.test.mjs` | regressions found in review: G1 and changelog growth, G2 for uncommitted files, S2 by segments, `disable`, Stop block limit, build timeout, multiple modules |
| `installer.test.mjs` | install, settings merge, update, byte-for-byte uninstall |
| `manifests.test.mjs` | the manifests of the three harnesses: confirmed events, timeout units, `PostToolUse` without shell |
| `scripts.test.mjs` | skill validator, token budget, routing |

The tests call `main(argv, stdin, env)` from `java-hooks.mjs` directly, without a process.
Projects are created in a temporary folder (`tempProject`); harness inputs are in
`tests/fixtures/inputs/`.

## Token budget

`scripts/check-tokens.mjs` (estimate: characters / 4):

| What | Limit | Why |
|---|---|---|
| Router | 1500 | in every session |
| Anchor | 60 | in every GigaCode message; the worst case is the three longest short texts |
| Recovery block | 500 | after every compaction; the worst case is five violated rules with the longest fixes |
| Role rules | 120 | on the first write of a role |

## Gate fixture

`tests/fixtures/gates-project` is a Maven project (Boot 4, ArchUnit) with the
`CodeRulesTest` from `java-quality-gates` and **one violation for each of the 13 rules**. CI
checks that `mvn -B -ntp test` fails with exactly `Tests run: 13, Failures: 13`. This shows
that every ArchUnit rule really catches its violation.

## CI

`.github/workflows/test.yml`:

- a Windows / Linux / macOS × Node 20 / 22 matrix: `node --test`, `validate-skills`,
  `check-tokens`;
- `gates-fixture` on Linux with JDK 21.

## How to add a hard or soft rule

1. A test in `rules.test.mjs`: an example that must be caught and a similar one that must
   not. Make sure the test fails.
2. The text in `RULES` (`rules.mjs`): `severity`, `short` (≤ 40 characters, for the
   anchor), `message`, `fix`, `example`.
3. The check in `findViolations`. Remember: strings and comments are already replaced with
   spaces.
4. If the rule is hard, a test in `pre.test.mjs` that an edit with it is blocked, while an
   edit next to a legacy violation is not.
5. Mention the rule in the router or in the relevant skill if the model must know it in
   advance.
6. The tables in `docs/*/how-it-works.md` and [04-rules.md](04-rules.md).
7. If the rule can be checked on bytecode, add it to `CodeRulesTest.java` and add a
   violation to the gate fixture (then the number 13 in CI changes as well).

## How to add a harness

1. Input fixtures in `tests/fixtures/inputs/`.
2. Tool and field names in `normalizeTool` (`io.mjs`).
3. A manifest that registers the hooks with `--harness <name>`.
4. If the harness accepts the response differently, a branch on `ctx.harness` in the
   handler.
5. A test in `manifests.test.mjs`.

Next: [10. Troubleshooting](10-troubleshooting.md).
