// v0.4: update notice from release tags.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installSource, latestTag, newer, stripCredentials } from '../hooks/lib/update.mjs';
import { installProject } from '../installer/project.mjs';
import { tempProject, BOOT4_POM } from './helpers.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const git = (dir, ...args) => execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { stdio: 'pipe', encoding: 'utf8' });

/** A minimal clone layout: .git, origin, plugin.json with a version, hooks/lib. */
export function fakeClone(version, origin) {
  const dir = tempProject({ '.claude-plugin/plugin.json': JSON.stringify({ name: 'forbxpg-java', version }), 'hooks/lib/.keep': '' });
  git(dir, 'init', '-q');
  git(dir, 'remote', 'add', 'origin', origin);
  return dir;
}

test('S-NOTE-3c / R-SRC-1: a clone is found by its .git and origin; nothing else is a source', () => {
  const clone = fakeClone('0.3.0', 'https://github.com/forbxpg/forbxpg-java-best-practices-skill.git');
  assert.deepEqual(installSource(join(clone, 'hooks', 'lib')), {
    kind: 'clone', version: '0.3.0', remote: 'https://github.com/forbxpg/forbxpg-java-best-practices-skill.git', cloneDir: clone,
  });
  const loose = tempProject({ '.claude-plugin/plugin.json': JSON.stringify({ version: '0.3.0' }), 'hooks/lib/.keep': '' });
  assert.equal(installSource(join(loose, 'hooks', 'lib')), null, 'no .git, no receipt → no source');
});

test('R-SRC-1: a project install is found by its receipt', () => {
  const dir = tempProject({
    '.gigacode/forbxpg-java/install-receipt.json': JSON.stringify({ name: 'forbxpg-java', version: '0.2.0', agent: 'gigacode', source: { remote: 'https://bitbucket.example/scm/team/fj.git' } }),
    '.gigacode/forbxpg-java/hooks/lib/.keep': '',
  });
  assert.deepEqual(installSource(join(dir, '.gigacode/forbxpg-java/hooks/lib')), {
    kind: 'project', version: '0.2.0', remote: 'https://bitbucket.example/scm/team/fj.git', agent: 'gigacode',
  });
});

test('latestTag takes the highest plain vX.Y.Z, newer compares numerically', () => {
  assert.equal(latestTag(['refs/tags/v0.3.0', 'refs/tags/v0.10.0', 'refs/tags/v1.0.0-rc1', 'refs/tags/junk', 'v0.9.9']), '0.10.0');
  assert.equal(latestTag([]), null);
  assert.equal(newer('0.10.0', '0.9.0'), true);
  assert.equal(newer('0.3.0', '0.3.0'), false);
  assert.equal(newer('0.2.9', '0.3.0'), false);
});

test('Review Focus 1: credentials are cut from https remotes, ssh remotes stay as they are', () => {
  assert.equal(stripCredentials('https://user:secret@bitbucket.example/scm/team/fj.git'), 'https://bitbucket.example/scm/team/fj.git');
  assert.equal(stripCredentials('https://token@github.com/o/r.git'), 'https://github.com/o/r.git');
  assert.equal(stripCredentials('git@github.com:o/r.git'), 'git@github.com:o/r.git');
});

test('R-SRC-2: a project install records the clone remote without credentials, and no clone path', () => {
  const clone = tempProject();
  for (const part of ['skills', 'hooks', 'gigacode-extension.json', '.claude-plugin']) cpSync(join(REPO, part), join(clone, part), { recursive: true });
  git(clone, 'init', '-q');
  git(clone, 'remote', 'add', 'origin', 'https://user:secret@bitbucket.example/scm/team/fj.git');
  const project = tempProject({ 'pom.xml': BOOT4_POM });
  installProject({ repoDir: clone, projectDir: project, agent: 'gigacode' });
  const receipt = JSON.parse(readFileSync(join(project, '.gigacode/forbxpg-java/install-receipt.json'), 'utf8'));
  assert.deepEqual(receipt.source, { remote: 'https://bitbucket.example/scm/team/fj.git' });
  assert.ok(!JSON.stringify(receipt).includes(clone), 'the clone path is not in the receipt');
});
