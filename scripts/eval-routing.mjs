#!/usr/bin/env node
// Routing eval: does a model pick the expected skill from names + descriptions alone?
// Usage: ROUTING_API_KEY=... node scripts/eval-routing.mjs --endpoint https://host/v1 --model deepseek-chat
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseFrontmatter } from './validate-skills.mjs';

export function routingPrompt(skills, request) {
  const list = skills.map((s) => `- ${s.name}: ${s.description}`).join('\n');
  return `Available skills:\n${list}\n\nUser request: ${request}\n\nWhich one skill should be loaded for this request? Answer with the skill name only, or "none".`;
}

/** The first known skill name in the answer, "none", or the raw answer. */
export function matchSkill(answer, names) {
  const text = answer.toLowerCase();
  const found = names.filter((n) => text.includes(n)).sort((a, b) => b.length - a.length)[0];
  if (found) return found;
  return /\bnone\b/.test(text) ? 'none' : answer.trim();
}

function loadSkills(skillsDir) {
  return readdirSync(skillsDir)
    .filter((f) => existsSync(join(skillsDir, f, 'SKILL.md')))
    .map((f) => parseFrontmatter(readFileSync(join(skillsDir, f, 'SKILL.md'), 'utf8')))
    .filter(Boolean);
}

async function ask(endpoint, model, key, content) {
  const response = await fetch(`${endpoint.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({ model, temperature: 0, messages: [{ role: 'user', content }] }),
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return (await response.json()).choices?.[0]?.message?.content ?? '';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (name) => process.argv[process.argv.indexOf(name) + 1];
  const endpoint = process.argv.includes('--endpoint') ? arg('--endpoint') : null;
  const model = process.argv.includes('--model') ? arg('--model') : null;
  if (!endpoint || !model) {
    console.log('usage: ROUTING_API_KEY=... node scripts/eval-routing.mjs --endpoint <OpenAI-compatible base URL> --model <id>');
    process.exit(2);
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const skills = loadSkills(join(root, 'skills'));
  const names = skills.map((s) => s.name);
  const cases = readFileSync(join(root, 'evals', 'routing.tsv'), 'utf8').split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith('#')).map((l) => l.split('\t').map((x) => x.trim()));
  let hits = 0;
  for (const [prompt, expected] of cases) {
    const got = matchSkill(await ask(endpoint, model, process.env.ROUTING_API_KEY, routingPrompt(skills, prompt)), names);
    const ok = got === expected;
    if (ok) hits += 1;
    console.log(`${ok ? 'ok  ' : 'MISS'} ${expected.padEnd(28)} ${ok ? '' : `got ${got.padEnd(28)}`} ${prompt}`);
  }
  console.log(`${hits}/${cases.length} routed correctly`);
  process.exitCode = hits === cases.length ? 0 : 1;
}
