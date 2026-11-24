import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { validateSkills } from '../scripts/validate-skills.mjs';
import { checkTokens } from '../scripts/check-tokens.mjs';
import { routingPrompt, matchSkill } from '../scripts/eval-routing.mjs';
import { tempProject } from './helpers.mjs';

const skill = (name, { description = 'Use when testing the validator with a realistic description.', body = '# Demo\n\nSee [ref](references/ref.md).\n', extra = '' } = {}) =>
  `---\nname: ${name}\ndescription: ${description}\n${extra}---\n\n${body}`;

function repo(files) {
  return tempProject(files);
}

test('R-REPO-1: a good skill passes', () => {
  const dir = repo({
    'skills/demo-skill/SKILL.md': skill('demo-skill'),
    'skills/demo-skill/references/ref.md': '# Ref\n',
    'evals/routing.tsv': '# header\nfirst prompt\tdemo-skill\nsecond prompt\tdemo-skill\n',
  });
  assert.deepEqual(validateSkills(join(dir, 'skills'), join(dir, 'evals/routing.tsv')).errors, []);
});

test('R-REPO-1: a bad name is rejected with the regex', () => {
  const dir = repo({
    'skills/Bad Name/SKILL.md': skill('Bad Name', { body: '# x\n' }),
    'evals/routing.tsv': 'a\tBad Name\nb\tBad Name\n',
  });
  const { errors } = validateSkills(join(dir, 'skills'), join(dir, 'evals/routing.tsv'));
  assert.ok(errors.some((e) => e.includes('^[a-z0-9]+(-[a-z0-9]+)*$')), errors.join('\n'));
});

test('R-REPO-1: SKILL.md over 150 lines and a reference over 250 lines are rejected with the count', () => {
  const dir = repo({
    'skills/long-skill/SKILL.md': skill('long-skill', { body: `${'line\n'.repeat(160)}See references/ref.md\n` }),
    'skills/long-skill/references/ref.md': 'x\n'.repeat(260),
    'evals/routing.tsv': 'a\tlong-skill\nb\tlong-skill\n',
  });
  const { errors } = validateSkills(join(dir, 'skills'), join(dir, 'evals/routing.tsv'));
  assert.ok(errors.some((e) => /SKILL\.md has 1\d\d lines/.test(e)), errors.join('\n'));
  assert.ok(errors.some((e) => /ref\.md has 260 lines/.test(e)), errors.join('\n'));
});

test('R-SKILL-1: fewer than two routing cases is an error', () => {
  const dir = repo({
    'skills/lonely-skill/SKILL.md': skill('lonely-skill', { body: '# x\n' }),
    'evals/routing.tsv': 'only one\tlonely-skill\n',
  });
  const { errors } = validateSkills(join(dir, 'skills'), join(dir, 'evals/routing.tsv'));
  assert.ok(errors.some((e) => e.includes('R-SKILL-1')), errors.join('\n'));
});

test('R-REPO-1: frontmatter rules — folder name, description length, unknown keys, broken links', () => {
  const dir = repo({
    'skills/folder-a/SKILL.md': skill('other-name', { description: 'x'.repeat(1100), extra: 'color: red\n', body: 'See references/missing.md\n' }),
    'evals/routing.tsv': 'a\tother-name\nb\tother-name\n',
  });
  const { errors } = validateSkills(join(dir, 'skills'), join(dir, 'evals/routing.tsv'));
  for (const fragment of ['folder', '1024', 'color', 'missing.md']) {
    assert.ok(errors.some((e) => e.includes(fragment)), `expected an error mentioning ${fragment}:\n${errors.join('\n')}`);
  }
});

test('routing cases naming an unknown skill are an error', () => {
  const dir = repo({
    'skills/demo-skill/SKILL.md': skill('demo-skill', { body: '# x\n' }),
    'evals/routing.tsv': 'a\tdemo-skill\nb\tdemo-skill\nc\tghost-skill\n',
  });
  const { errors } = validateSkills(join(dir, 'skills'), join(dir, 'evals/routing.tsv'));
  assert.ok(errors.some((e) => e.includes('ghost-skill')), errors.join('\n'));
});

test('R-REPO-2: checkTokens flags an oversized router and passes a small one', () => {
  const small = repo({ 'skills/using-java-best-practices/SKILL.md': 'x'.repeat(400) });
  assert.ok(checkTokens(small).every((r) => r.tokens <= r.limit));
  assert.ok(checkTokens(small).some((r) => r.item === 'anchor'));
  assert.ok(checkTokens(small).some((r) => r.item === 'role:entity'));
  const big = repo({ 'skills/using-java-best-practices/SKILL.md': 'x'.repeat(7000) });
  const router = checkTokens(big).find((r) => r.item === 'router');
  assert.ok(router.tokens > router.limit);
  const missing = checkTokens(repo({})).find((r) => r.item === 'router');
  assert.equal(missing.tokens, Infinity);
});

test('eval-routing helpers: prompt lists every skill, answer matching is tolerant', () => {
  const skills = [{ name: 'java-testing', description: 'tests' }, { name: 'spring-data-jpa', description: 'jpa' }];
  const prompt = routingPrompt(skills, 'my repository fires 200 queries');
  assert.match(prompt, /java-testing: tests/);
  assert.match(prompt, /my repository fires 200 queries/);
  assert.equal(matchSkill('`spring-data-jpa`.', skills.map((s) => s.name)), 'spring-data-jpa');
  assert.equal(matchSkill('none', skills.map((s) => s.name)), 'none');
});
