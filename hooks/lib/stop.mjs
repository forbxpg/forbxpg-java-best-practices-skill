// Stop: warn once when the context fills up; compile what the session changed and block on its own errors.
import { existsSync, statSync, realpathSync } from 'node:fs';
import { dirname, join, relative, resolve, normalize } from 'node:path';
import { readState, writeState, sha1, changedFiles } from './state.mjs';
import { mavenCommand, runCompile as realRunCompile, parseCompileErrors } from './maven.mjs';

const COMPILE_TIMEOUT_MS = 180_000;
const MAX_BLOCKS = 2;
const UNVERIFIABLE = /offline mode|Could not resolve|Non-resolvable|Could not find artifact|is not recognized|command not found|ENOENT|EACCES|Permission denied/i;

const block = (reason) => ({ stdout: JSON.stringify({ decision: 'block', reason }) });
const notice = (systemMessage) => ({ stdout: JSON.stringify({ systemMessage }) });

/** Nearest folder at or above the file's folder that has a pom.xml, relative to the project ('' = root). */
function moduleOf(file, projectDir) {
  let dir = dirname(file);
  while (dir.startsWith(projectDir) && dir !== projectDir) {
    if (existsSync(join(dir, 'pom.xml'))) return relative(projectDir, dir);
    dir = dirname(dir);
  }
  return '';
}

/** Real path when it exists (resolves /var → /private/var and the like), with forward slashes. */
function realOrSelf(path) {
  try {
    return normalize(realpathSync.native(path)).replace(/\\/g, '/');
  } catch {
    return normalize(path).replace(/\\/g, '/');
  }
}
const samePath = (a, b) => realOrSelf(a).toLowerCase() === realOrSelf(b).toLowerCase();

export async function handleStop(input, ctx, runCompile = realRunCompile) {
  const usage = Number(input.context_usage);
  if (!input.stop_hook_active && usage >= ctx.config.contextWarnAt && !readState(ctx.stateDir, 'contextWarned', false)) {
    writeState(ctx.stateDir, 'contextWarned', true);
    const percent = Math.round(usage * 100);
    return block(`[forbxpg-java] The context is ${percent}% full and older details will soon be compacted away. Before you stop, write a handoff note: if grillspec is installed, grillspec note handoff -- "done: ...; next: ...; open: ..."; otherwise put the same three lines at the top of your plan file. Then finish your answer.`);
  }

  if (!ctx.config.stopCompile) return {};
  const changed = changedFiles(ctx.stateDir).filter((f) => existsSync(f));
  if (changed.length === 0) return {};
  const fingerprint = sha1(changed.map((f) => `${f}:${statSync(f).mtimeMs}`).sort().join('\n'));
  if (readState(ctx.stateDir, 'lastOkFingerprint', null) === fingerprint) return {};

  const modules = [...new Set(changed.map((f) => moduleOf(resolve(f), ctx.projectDir)))];
  const result = await runCompile(mavenCommand(ctx.projectDir, modules, ctx.platform), COMPILE_TIMEOUT_MS);
  if (result.timedOut) return notice('[forbxpg-java] Could not verify the build: the compile timed out.');
  const { output } = result;
  if (result.ok) {
    writeState(ctx.stateDir, 'lastOkFingerprint', fingerprint);
    writeState(ctx.stateDir, 'blocksSinceOk', 0);
    return {};
  }

  const errors = parseCompileErrors(output);
  const own = errors.filter((e) => changed.some((f) => samePath(f, e.file)));
  if (own.length === 0) {
    if (errors.length === 0 && UNVERIFIABLE.test(output)) return notice('[forbxpg-java] Could not verify the build offline (missing artifacts or Maven not available). Run the build yourself.');
    return notice('[forbxpg-java] The change could not be verified: the build fails in files this session did not change.');
  }
  // Counted since the last successful compile, not per change set: every fix attempt changes the files.
  const blocks = readState(ctx.stateDir, 'blocksSinceOk', 0);
  if (blocks >= MAX_BLOCKS) {
    return notice('[forbxpg-java] The code still does not compile after two attempts; stopping without verification.');
  }
  writeState(ctx.stateDir, 'blocksSinceOk', blocks + 1);
  const lines = [...new Set(own.map((e) => `- ${relative(realOrSelf(ctx.projectDir), realOrSelf(e.file)).replace(/\\/g, '/')}:${e.line} ${e.message}`))].slice(0, 10);
  return block(`[forbxpg-java] The code does not compile:\n${lines.join('\n')}\nFix these errors before you finish.`);
}
