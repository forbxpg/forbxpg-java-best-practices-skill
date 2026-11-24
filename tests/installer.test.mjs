import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { installProject, uninstallProject } from '../installer/project.mjs';
import { tempProject, BOOT4_POM } from './helpers.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (dir, rel) => readFileSync(join(dir, rel), 'utf8');

/** Every file under dir → content, for byte-for-byte comparisons. */
function snapshot(dir) {
  const out = {};
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out[relative(dir, p).replace(/\\/g, '/')] = readFileSync(p, 'utf8');
    }
  };
  walk(dir);
  return out;
}

const FOREIGN_SETTINGS = `{
    "permissions": { "allow": ["Read"] },
    "hooks": { "PreToolUse": [ { "matcher": ".*", "hooks": [ { "type": "command", "command": "node other-tool.mjs" } ] } ] }
}
`;

test('GigaCode project install: skills, hooks, settings block, GIGACODE.md import, receipt', () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM });
  installProject({ repoDir: REPO, projectDir: dir, agent: 'gigacode' });
  assert.ok(existsSync(join(dir, '.gigacode/skills/java-conventions/SKILL.md')));
  assert.ok(existsSync(join(dir, '.gigacode/forbxpg-java/hooks/java-hooks.mjs')));
  assert.ok(existsSync(join(dir, '.gigacode/forbxpg-java/hooks/lib/rules.mjs')));
  const settings = JSON.parse(read(dir, '.gigacode/settings.json'));
  const pre = settings.hooks.PreToolUse[0];
  assert.equal(pre.hooks[0].command, 'node .gigacode/forbxpg-java/hooks/java-hooks.mjs PreToolUse --harness gigacode');
  assert.equal(pre.matcher, '^(write_file|edit|replace|run_shell_command)$');
  assert.match(read(dir, 'GIGACODE.md'), /^@\.gigacode\/skills\/using-java-best-practices\/SKILL\.md$/m);
  const receipt = JSON.parse(read(dir, '.gigacode/forbxpg-java/install-receipt.json'));
  assert.ok(Object.keys(receipt.files).every((p) => !p.includes('\\')), 'receipt paths use /');
  assert.ok(receipt.files['.gigacode/skills/java-conventions/SKILL.md']);
});

test('S-INST-4a: foreign settings keys and hooks survive; ours appear once after two installs', () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM, '.gigacode/settings.json': FOREIGN_SETTINGS });
  installProject({ repoDir: REPO, projectDir: dir, agent: 'gigacode' });
  installProject({ repoDir: REPO, projectDir: dir, agent: 'gigacode' });
  const settings = JSON.parse(read(dir, '.gigacode/settings.json'));
  assert.deepEqual(settings.permissions, { allow: ['Read'] });
  const commands = settings.hooks.PreToolUse.flatMap((g) => g.hooks.map((h) => h.command));
  assert.equal(commands.filter((c) => c === 'node other-tool.mjs').length, 1);
  assert.equal(commands.filter((c) => c.includes('forbxpg-java')).length, 1);
  assert.equal(read(dir, 'GIGACODE.md').match(/using-java-best-practices/g).length, 1);
});

test('S-INST-5a: install then uninstall restores the project byte for byte', () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM, '.gigacode/settings.json': FOREIGN_SETTINGS, 'GIGACODE.md': '# Project\n\nRules here.\n' });
  const before = snapshot(dir);
  installProject({ repoDir: REPO, projectDir: dir, agent: 'gigacode' });
  uninstallProject({ projectDir: dir, agent: 'gigacode' });
  assert.deepEqual(snapshot(dir), before);
  const empty = tempProject({ 'pom.xml': BOOT4_POM });
  const emptyBefore = snapshot(empty);
  installProject({ repoDir: REPO, projectDir: empty, agent: 'gigacode' });
  uninstallProject({ projectDir: empty, agent: 'gigacode' });
  assert.deepEqual(snapshot(empty), emptyBefore);
  assert.ok(!existsSync(join(empty, '.gigacode')), 'the .gigacode folder it created is gone');
});

test('R-INST-7: the copied hook runs from the project and blocks a J1 write', () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM });
  installProject({ repoDir: REPO, projectDir: dir, agent: 'gigacode' });
  const input = JSON.stringify({ session_id: 's', cwd: dir, tool_name: 'write_file', tool_input: { file_path: join(dir, 'src/main/java/a/A.java'), content: 'class A { @Autowired private B b; }' } });
  const env = { ...process.env, CLAUDE_PROJECT_DIR: '', GIGACODE_PROJECT_DIR: '', QWEN_PROJECT_DIR: '' };
  const r = spawnSync(process.execPath, ['.gigacode/forbxpg-java/hooks/java-hooks.mjs', 'PreToolUse', '--harness', 'gigacode'], { cwd: dir, input, env, encoding: 'utf8' });
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /J1/);
});

test('R-INST-8: dry run reports the plan and writes nothing', () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM });
  const before = snapshot(dir);
  const result = installProject({ repoDir: REPO, projectDir: dir, agent: 'gigacode', dryRun: true });
  assert.ok(result.written.length > 10);
  assert.deepEqual(snapshot(dir), before);
});

test('Review Focus 1: settings.json with comments is refused and left untouched', () => {
  const jsonc = '{\n  // team settings\n  "permissions": {},\n}\n';
  const dir = tempProject({ 'pom.xml': BOOT4_POM, '.gigacode/settings.json': jsonc });
  assert.throws(() => installProject({ repoDir: REPO, projectDir: dir, agent: 'gigacode' }), /settings\.json.*not plain JSON/);
  assert.equal(read(dir, '.gigacode/settings.json'), jsonc);
  assert.ok(!existsSync(join(dir, '.gigacode/skills')), 'nothing copied when settings cannot be merged');
});
