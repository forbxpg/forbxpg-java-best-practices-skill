import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { installProject, uninstallProject } from '../installer/project.mjs';
import { runCommand, windowsCommandLine } from '../installer/user.mjs';
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

test('S-INST-5a: the "$version" key GigaCode adds to settings.json does not survive uninstall', () => {
  const addVersion = (dir) => {
    const path = join(dir, '.gigacode/settings.json');
    writeFileSync(path, JSON.stringify({ $version: 4, ...JSON.parse(readFileSync(path, 'utf8')) }, null, 2));
  };
  for (const files of [{ 'pom.xml': BOOT4_POM }, { 'pom.xml': BOOT4_POM, '.gigacode/settings.json': FOREIGN_SETTINGS }]) {
    const dir = tempProject(files);
    const before = snapshot(dir);
    installProject({ repoDir: REPO, projectDir: dir, agent: 'gigacode' });
    addVersion(dir);
    uninstallProject({ projectDir: dir, agent: 'gigacode' });
    assert.deepEqual(snapshot(dir), before);
  }
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

test('invalid hook entries fail before any project file is copied', () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM, '.gigacode/settings.json': '{"hooks":{"PreToolUse":[null]}}\n' });
  assert.throws(() => installProject({ repoDir: REPO, projectDir: dir, agent: 'gigacode' }));
  assert.ok(!existsSync(join(dir, '.gigacode/skills')));
  assert.ok(!existsSync(join(dir, '.gigacode/forbxpg-java')));
});

test('uninstall dry-run deletes nothing', () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM });
  installProject({ repoDir: REPO, projectDir: dir, agent: 'gigacode' });
  const before = snapshot(dir);
  const result = uninstallProject({ projectDir: dir, agent: 'gigacode', dryRun: true });
  assert.ok(result.removed.length > 10);
  assert.deepEqual(snapshot(dir), before);
});

test('CLI --dry-run uninstall does not delete files', () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM });
  installProject({ repoDir: REPO, projectDir: dir, agent: 'gigacode' });
  const before = snapshot(dir);
  const r = spawnSync(process.execPath, [
    join(REPO, 'install.mjs'), '--agent', 'gigacode', '--scope', 'project', '--project', dir, '--uninstall', '--dry-run',
  ], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Would uninstall/);
  assert.deepEqual(snapshot(dir), before);
});

test('uninstall refuses broken settings before deleting hook files', () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM });
  installProject({ repoDir: REPO, projectDir: dir, agent: 'gigacode' });
  const hook = join(dir, '.gigacode/forbxpg-java/hooks/java-hooks.mjs');
  writeFileSync(join(dir, '.gigacode/settings.json'), '{ "hooks": {}, }\n');
  assert.throws(() => uninstallProject({ projectDir: dir, agent: 'gigacode' }), /not plain JSON/);
  assert.ok(existsSync(hook));
});

test('uninstall keeps a router import that was already in GIGACODE.md', () => {
  const original = '# Project\n\n@.gigacode/skills/using-java-best-practices/SKILL.md\n';
  const dir = tempProject({ 'pom.xml': BOOT4_POM, 'GIGACODE.md': original });
  installProject({ repoDir: REPO, projectDir: dir, agent: 'gigacode' });
  uninstallProject({ projectDir: dir, agent: 'gigacode' });
  assert.equal(read(dir, 'GIGACODE.md'), original);
});

test('a foreign command that only contains forbxpg-java is not treated as ours', () => {
  const command = 'node /tools/forbxpg-java-audit/check.mjs';
  const settings = `{"hooks":{"PreToolUse":[{"hooks":[{"type":"command","command":${JSON.stringify(command)}}]}]}}\n`;
  const dir = tempProject({ 'pom.xml': BOOT4_POM, '.gigacode/settings.json': settings });
  installProject({ repoDir: REPO, projectDir: dir, agent: 'gigacode' });
  const installed = JSON.parse(read(dir, '.gigacode/settings.json'));
  const commands = installed.hooks.PreToolUse.flatMap((g) => g.hooks.map((h) => h.command));
  assert.ok(commands.includes(command));
  uninstallProject({ projectDir: dir, agent: 'gigacode' });
  const restored = JSON.parse(read(dir, '.gigacode/settings.json'));
  assert.equal(restored.hooks.PreToolUse[0].hooks[0].command, command);
});

test('Review Focus 1: settings.json with comments is refused and left untouched', () => {
  const jsonc = '{\n  // team settings\n  "permissions": {},\n}\n';
  const dir = tempProject({ 'pom.xml': BOOT4_POM, '.gigacode/settings.json': jsonc });
  assert.throws(() => installProject({ repoDir: REPO, projectDir: dir, agent: 'gigacode' }), /settings\.json.*not plain JSON/);
  assert.equal(read(dir, '.gigacode/settings.json'), jsonc);
  assert.ok(!existsSync(join(dir, '.gigacode/skills')), 'nothing copied when settings cannot be merged');
});

// ---- 2.2: Claude Code layout, coexistence, update and force ----
import { cpSync, rmSync as rm, mkdirSync as mkdir } from 'node:fs';

/** A copy of the repository parts the installer reads, so a test can change the source. */
function repoCopy() {
  const dir = tempProject();
  for (const part of ['skills', 'hooks', 'gigacode-extension.json', '.claude-plugin']) cpSync(join(REPO, part), join(dir, part), { recursive: true });
  return dir;
}

test('Claude Code project install: .claude layout, $CLAUDE_PROJECT_DIR command, no GIGACODE.md', () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM });
  installProject({ repoDir: REPO, projectDir: dir, agent: 'claude' });
  assert.ok(existsSync(join(dir, '.claude/skills/java-testing/SKILL.md')));
  assert.ok(existsSync(join(dir, '.claude/forbxpg-java/hooks/lib/stop.mjs')));
  const settings = JSON.parse(read(dir, '.claude/settings.json'));
  const pre = settings.hooks.PreToolUse[0];
  assert.equal(pre.hooks[0].command, 'node "$CLAUDE_PROJECT_DIR/.claude/forbxpg-java/hooks/java-hooks.mjs" PreToolUse --harness claude');
  assert.equal(pre.matcher, 'Write|Edit|MultiEdit|Bash');
  assert.ok(!existsSync(join(dir, 'GIGACODE.md')));
});

test('the Claude-installed hook prints the router at SessionStart', () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM });
  installProject({ repoDir: REPO, projectDir: dir, agent: 'claude' });
  const env = { ...process.env, CLAUDE_PROJECT_DIR: dir, GIGACODE_PROJECT_DIR: '', QWEN_PROJECT_DIR: '' };
  const r = spawnSync(process.execPath, [join(dir, '.claude/forbxpg-java/hooks/java-hooks.mjs'), 'SessionStart', '--harness', 'claude'],
    { cwd: dir, input: JSON.stringify({ session_id: 's', cwd: dir, source: 'startup' }), env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Java best practices: core rules/);
});

test('Review Focus 3: GigaCode and Claude Code installs coexist; removing one keeps the other', () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM });
  installProject({ repoDir: REPO, projectDir: dir, agent: 'gigacode' });
  installProject({ repoDir: REPO, projectDir: dir, agent: 'claude' });
  uninstallProject({ projectDir: dir, agent: 'claude' });
  assert.ok(!existsSync(join(dir, '.claude')));
  assert.ok(existsSync(join(dir, '.gigacode/skills/java-conventions/SKILL.md')));
  assert.ok(JSON.parse(read(dir, '.gigacode/settings.json')).hooks.PreToolUse);
});

test('S-INST-6a: --update keeps a skill edited in the project; --force replaces it', () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM });
  installProject({ repoDir: REPO, projectDir: dir, agent: 'gigacode' });
  const rel = '.gigacode/skills/java-conventions/SKILL.md';
  writeFileSync(join(dir, rel), `${read(dir, rel)}\n- Team rule: no Feign.\n`);
  const kept = installProject({ repoDir: REPO, projectDir: dir, agent: 'gigacode' });
  assert.deepEqual(kept.skipped, [rel]);
  assert.match(read(dir, rel), /Team rule: no Feign/);
  installProject({ repoDir: REPO, projectDir: dir, agent: 'gigacode', force: true });
  assert.doesNotMatch(read(dir, rel), /Team rule/);
});

test('update replaces unchanged files, adds new ones and removes files the new version dropped', () => {
  const repo = repoCopy();
  const dir = tempProject({ 'pom.xml': BOOT4_POM });
  installProject({ repoDir: repo, projectDir: dir, agent: 'gigacode' });
  mkdir(join(repo, 'skills/java-new-skill'), { recursive: true });
  writeFileSync(join(repo, 'skills/java-new-skill/SKILL.md'), '---\nname: java-new-skill\ndescription: x\n---\n');
  writeFileSync(join(repo, 'skills/java-testing/SKILL.md'), 'updated testing skill\n');
  rm(join(repo, 'skills/java-verification'), { recursive: true });
  const result = installProject({ repoDir: repo, projectDir: dir, agent: 'gigacode' });
  assert.equal(read(dir, '.gigacode/skills/java-testing/SKILL.md'), 'updated testing skill\n');
  assert.ok(existsSync(join(dir, '.gigacode/skills/java-new-skill/SKILL.md')));
  assert.ok(!existsSync(join(dir, '.gigacode/skills/java-verification')));
  assert.ok(result.removed.includes('.gigacode/skills/java-verification/SKILL.md'));
});

// ---- 2.3: user scope through the agents' CLIs ----
import { installUser } from '../installer/user.mjs';

function fakeRunner(status = 0) {
  const calls = [];
  const run = (cmd, args, opts = {}) => {
    calls.push({ cmd, args, input: opts.input });
    return { status, output: status === 0 ? 'ok' : 'boom: not logged in' };
  };
  return { run, calls };
}

test('Windows command line keeps a repository path with spaces as one argument', () => {
  assert.equal(
    windowsCommandLine('gigacode', ['extensions', 'link', 'C:\\Users\\Jane Doe\\forbxpg-java']),
    'gigacode extensions link "C:\\Users\\Jane Doe\\forbxpg-java"',
  );
  const calls = [];
  const spawn = (file, args, opts) => {
    calls.push({ file, args, verbatim: opts.windowsVerbatimArguments });
    return { status: 0, stdout: '', stderr: '' };
  };
  const quoted = runCommand('gigacode', ['extensions', 'link', 'C:\\Users\\Jane Doe\\forbxpg-java'], { platform: 'win32', spawn });
  assert.equal(quoted.status, 0);
  assert.equal(calls[0].file, process.env.ComSpec || 'cmd.exe');
  assert.deepEqual(calls[0].args, ['/d', '/s', '/c', 'gigacode extensions link "C:\\Users\\Jane Doe\\forbxpg-java"']);
  assert.equal(calls[0].verbatim, true);
  const r = runCommand(process.execPath, ['-e', 'process.stdout.write(process.argv[1])', 'Jane Doe']);
  assert.equal(r.status, 0);
  assert.equal(r.output, 'Jane Doe');
});

test('user scope, GigaCode: link answers Y; uninstall removes the extension', () => {
  const fake = fakeRunner();
  installUser({ repoDir: REPO, agent: 'gigacode' }, fake.run);
  assert.deepEqual(fake.calls[0], { cmd: 'gigacode', args: ['extensions', 'link', REPO], input: 'Y\n' });
  installUser({ repoDir: REPO, agent: 'gigacode', uninstall: true }, fake.run);
  assert.deepEqual(fake.calls[1].args, ['extensions', 'uninstall', 'forbxpg-java']);
});

test('user scope, Claude Code: marketplace add + plugin install; uninstall reverses both', () => {
  const fake = fakeRunner();
  installUser({ repoDir: REPO, agent: 'claude' }, fake.run);
  assert.deepEqual(fake.calls.map((c) => c.args), [['plugin', 'marketplace', 'add', REPO], ['plugin', 'install', 'forbxpg-java@forbxpg-java']]);
  installUser({ repoDir: REPO, agent: 'claude', uninstall: true }, fake.run);
  assert.deepEqual(fake.calls.slice(2).map((c) => c.args), [['plugin', 'uninstall', 'forbxpg-java@forbxpg-java'], ['plugin', 'marketplace', 'remove', 'forbxpg-java']]);
});

test('user scope: a failing agent command is reported with its output', () => {
  const fake = fakeRunner(1);
  assert.throws(() => installUser({ repoDir: REPO, agent: 'claude' }, fake.run), /claude plugin marketplace add .* failed.*not logged in/s);
});
