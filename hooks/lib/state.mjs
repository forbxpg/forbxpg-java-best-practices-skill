// Per-session hook state outside the project: <tmp>/forbxpg-java/<project hash>/<session>/.
import { mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function sha1(text) {
  return createHash('sha1').update(text).digest('hex');
}

/** Cache folder shared by all sessions of one project. */
export function projectCacheDir(projectDir) {
  return join(tmpdir(), 'forbxpg-java', sha1(projectDir).slice(0, 12));
}

export function sessionDir(projectDir, sessionId) {
  const safe = String(sessionId || 'unknown').replace(/[^A-Za-z0-9_.-]/g, '_');
  return join(projectCacheDir(projectDir), safe);
}

const keyFile = (dir, key) => join(dir, `${key.replace(/[^A-Za-z0-9_.-]/g, '_')}.json`);

export function readState(dir, key, fallback) {
  try {
    return JSON.parse(readFileSync(keyFile(dir, key), 'utf8'));
  } catch {
    return fallback;
  }
}

export function writeState(dir, key, value) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(keyFile(dir, key), JSON.stringify(value));
}

export function logError(dir, err) {
  try {
    mkdirSync(dir, { recursive: true });
    const message = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
    appendFileSync(join(dir, 'hook.log'), `${new Date().toISOString()} ${message}\n`);
  } catch {
    // Logging must never break the hook.
  }
}
