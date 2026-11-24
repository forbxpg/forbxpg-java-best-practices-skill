import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { projectDir, isMavenProject, normalizeTool } from '../hooks/lib/io.mjs';
import { sessionDir, readState, writeState } from '../hooks/lib/state.mjs';
import { loadConfig } from '../hooks/lib/config.mjs';
import { fixtureInput, tempProject, uniqueSession } from './helpers.mjs';

test('R-HOOK-1: projectDir prefers CLAUDE_PROJECT_DIR, then GIGACODE, then QWEN, then cwd', () => {
  const input = { cwd: '/from-input' };
  assert.equal(projectDir(input, { CLAUDE_PROJECT_DIR: '/c', GIGACODE_PROJECT_DIR: '/g', QWEN_PROJECT_DIR: '/q' }), '/c');
  assert.equal(projectDir(input, { GIGACODE_PROJECT_DIR: '/g', QWEN_PROJECT_DIR: '/q' }), '/g');
  assert.equal(projectDir(input, { QWEN_PROJECT_DIR: '/q' }), '/q');
  assert.equal(projectDir(input, {}), '/from-input');
});

test('R-HOOK-2: isMavenProject is true only with pom.xml', () => {
  assert.equal(isMavenProject(tempProject({ 'pom.xml': '<project/>' })), true);
  assert.equal(isMavenProject(tempProject({ 'setup.py': '' })), false);
});

test('R-HOOK-4: normalizeTool reads Claude Write/Edit/Bash', () => {
  assert.deepEqual(normalizeTool(fixtureInput('claude-write')),
    { kind: 'write', filePath: '/proj/src/main/java/a/Foo.java', content: 'class Foo {}\n' });
  assert.deepEqual(normalizeTool(fixtureInput('claude-edit')), {
    kind: 'edit', filePath: '/proj/src/main/java/a/Foo.java',
    oldString: 'class Foo {}', newString: 'class Foo { int x; }', replaceAll: false,
  });
  assert.deepEqual(normalizeTool(fixtureInput('claude-shell')), { kind: 'shell', command: 'mvn -q compile' });
});

test('R-HOOK-4: normalizeTool reads GigaCode write_file/edit/run_shell_command', () => {
  assert.equal(normalizeTool(fixtureInput('gigacode-write')).kind, 'write');
  assert.equal(normalizeTool(fixtureInput('gigacode-write')).content, 'class Foo {}\r\n');
  const edit = normalizeTool(fixtureInput('gigacode-edit'));
  assert.equal(edit.kind, 'edit');
  assert.equal(edit.replaceAll, false);
  assert.equal(edit.newString, 'class Foo { int x; }');
  assert.deepEqual(normalizeTool(fixtureInput('gigacode-shell')), { kind: 'shell', command: 'echo ok' });
});

test('R-HOOK-4: normalizeTool reads Codex shell array and apply_patch file headers', () => {
  assert.deepEqual(normalizeTool(fixtureInput('codex-shell')), { kind: 'shell', command: 'bash -lc mvn -q compile' });
  assert.deepEqual(normalizeTool(fixtureInput('codex-patch')), { kind: 'patch', files: [{ op: 'update', path: 'src/main/java/a/Foo.java' }] });
  assert.deepEqual(normalizeTool({ tool_name: 'exec_command', tool_input: { cmd: 'git push -f' } }), { kind: 'shell', command: 'git push -f' });
});

test('R-HOOK-4: normalizeTool reads alternative field names and MultiEdit', () => {
  assert.equal(normalizeTool({ tool_name: 'replace', tool_input: { path: '/x.java', oldString: 'a', newString: 'b' } }).filePath, '/x.java');
  assert.equal(normalizeTool({ tool_name: 'write_file', tool_input: { absolute_path: '/y.java', content: '' } }).filePath, '/y.java');
  const multi = normalizeTool({ tool_name: 'MultiEdit', tool_input: { file_path: '/z.java', edits: [{ old_string: 'a', new_string: 'b' }, { old_string: 'c', new_string: 'd' }] } });
  assert.equal(multi.kind, 'edit');
  assert.equal(multi.oldString, 'a');
  assert.equal(normalizeTool({ tool_name: 'read_file', tool_input: {} }).kind, 'other');
});

test('R-HOOK-5: state lives under os.tmpdir()/forbxpg-java and round-trips JSON', () => {
  const dir = sessionDir('/some/project', uniqueSession());
  assert.match(dir, /forbxpg-java[\\/][0-9a-f]{12}[\\/]/);
  assert.equal(readState(dir, 'missing', 42), 42);
  writeState(dir, 'k', { a: 1 });
  assert.deepEqual(readState(dir, 'k', null), { a: 1 });
});

test('config: project file over home file over defaults', () => {
  const home = tempProject({ '.forbxpg-java.json': JSON.stringify({ anchor: true, contextWarnAt: 0.5 }) });
  const proj = tempProject({ 'forbxpg-java.json': JSON.stringify({ anchor: false }) });
  assert.deepEqual(loadConfig(proj, home), { anchor: false, stopCompile: true, contextWarnAt: 0.5, disable: [] });
  assert.deepEqual(loadConfig(tempProject(), tempProject()), { anchor: null, stopCompile: true, contextWarnAt: 0.7, disable: [] });
  const broken = tempProject();
  writeFileSync(join(broken, 'forbxpg-java.json'), '{not json');
  assert.deepEqual(loadConfig(broken, tempProject()), { anchor: null, stopCompile: true, contextWarnAt: 0.7, disable: [] });
});
