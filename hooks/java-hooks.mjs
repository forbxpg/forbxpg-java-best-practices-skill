#!/usr/bin/env node
// forbxpg-java hooks entry point: node java-hooks.mjs <Event> --harness claude|gigacode|codex
import { homedir } from 'node:os';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { projectDir, findMavenRoot } from './lib/io.mjs';
import { sessionDir, logError } from './lib/state.mjs';
import { loadConfig } from './lib/config.mjs';
import { handlePreToolUse } from './lib/pre.mjs';
import { handlePostToolUse } from './lib/post.mjs';
import { handleSessionStart, handlePostCompact, handleUserPromptSubmit } from './lib/session.mjs';
import { handleStop } from './lib/stop.mjs';

/** Event name → handler(input, ctx) returning { exitCode, stdout, stderr } (sync or async). */
const HANDLERS = {
  PreToolUse: handlePreToolUse,
  PostToolUse: handlePostToolUse,
  SessionStart: handleSessionStart,
  PostCompact: handlePostCompact,
  UserPromptSubmit: handleUserPromptSubmit,
  Stop: (input, ctx) => handleStop(input, ctx),
};

/** Events this entry point handles; manifests may only register these. */
export const EVENTS = Object.keys(HANDLERS);

const EMPTY = Object.freeze({ exitCode: 0, stdout: '', stderr: '' });

function parseArgs(argv) {
  const event = argv[0] ?? '';
  const index = argv.indexOf('--harness');
  const harness = index >= 0 ? argv[index + 1] ?? 'claude' : 'claude';
  return { event, harness };
}

export async function main(argv, stdinText, env) {
  const { event, harness } = parseArgs(argv);
  let input;
  try {
    input = JSON.parse(stdinText);
  } catch (err) {
    logError(sessionDir(projectDir(null, env), 'unknown'), `invalid JSON on stdin: ${err.message}`);
    return { ...EMPTY };
  }
  const handler = HANDLERS[event];
  const dir = handler ? findMavenRoot(input, env) : null;
  if (!dir) return { ...EMPTY };
  const stateDir = sessionDir(dir, input.session_id);
  try {
    const ctx = {
      env, harness, projectDir: dir, cwd: projectDir(input, env), stateDir,
      homeDir: env.HOME || env.USERPROFILE || homedir(),
      platform: process.platform,
    };
    ctx.config = loadConfig(dir, ctx.homeDir);
    const result = await handler(input, ctx);
    return { ...EMPTY, ...result };
  } catch (err) {
    logError(stateDir, err);
    return { ...EMPTY };
  }
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

/** Run as a script, also through symlinks, junctions and subst drives (import.meta.url is the real path). */
function isEntryPoint() {
  try {
    return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  const result = await main(process.argv.slice(2), await readStdin(), process.env);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
}
