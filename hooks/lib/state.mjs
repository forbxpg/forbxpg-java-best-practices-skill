// Per-session hook state outside the project: <tmp>/forbxpg-java/<project hash>/<session>/.
import { mkdirSync, readFileSync, writeFileSync, appendFileSync, readdirSync, rmSync, openSync, writeSync, closeSync, renameSync, existsSync } from 'node:fs';
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

export function removeState(dir, key) {
  rmSync(keyFile(dir, key), { force: true });
}

/*
 * Sets kept as one marker file per member, so parallel hook processes never overwrite each
 * other (a shared JSON list loses entries under a read-modify-write race).
 */
const markerFile = (dir, set, key) => join(dir, set, `${sha1(key).slice(0, 16)}.txt`);

/** Adds key to the set; true when this call added it, false when it was already there. */
export function claimOnce(dir, set, key) {
  mkdirSync(join(dir, set), { recursive: true });
  const path = markerFile(dir, set, key);
  let fd;
  try {
    fd = openSync(path, 'wx');
  } catch (err) {
    if (err.code === 'EEXIST') return false;
    throw err;
  }
  try {
    writeSync(fd, key);
  } catch (err) {
    try { closeSync(fd); } catch { /* the write already failed */ }
    rmSync(path, { force: true });
    throw err;
  }
  closeSync(fd);
  return true;
}

/** Drops a claim this process just took, so a later call can try the work again. */
export function releaseClaim(dir, set, key) {
  rmSync(markerFile(dir, set, key), { force: true });
}

export function hasMarker(dir, set, key) {
  return existsSync(markerFile(dir, set, key));
}

function markerNames(dir, set) {
  try {
    return readdirSync(join(dir, set)).filter((f) => f.endsWith('.txt'));
  } catch {
    return null;
  }
}

export function members(dir, set) {
  const names = markerNames(dir, set);
  if (!names) return [];
  const out = [];
  for (const name of names.sort()) {
    try {
      out.push(readFileSync(join(dir, set, name), 'utf8'));
    } catch {
      // One unreadable marker must not hide the rest of the set.
    }
  }
  return out;
}

export const addChangedFile = (dir, path) => claimOnce(dir, 'changed', path);
export const changedFiles = (dir) => members(dir, 'changed');

function stamped(dir, set) {
  const names = markerNames(dir, set);
  if (!names) return [];
  const out = [];
  for (const name of names) {
    try {
      out.push(JSON.parse(readFileSync(join(dir, set, name), 'utf8')));
    } catch {
      // A truncated marker must not discard the other entries.
    }
  }
  return out;
}

/**
 * Records key in an ordered set with a stamp newer than every other member (one file per key,
 * so parallel processes only race on the order of near-simultaneous keys, never lose one).
 */
function touch(dir, set, key) {
  mkdirSync(join(dir, set), { recursive: true });
  const at = Math.max(Date.now(), ...stamped(dir, set).map((m) => (Number.isFinite(m.at) ? m.at + 1 : 0)));
  const path = markerFile(dir, set, key);
  const tmp = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(tmp, JSON.stringify({ key, at }));
    renameSync(tmp, path);
  } catch (err) {
    rmSync(tmp, { force: true });
    throw err;
  }
}

const newestFirst = (dir, set) => stamped(dir, set).sort((a, b) => b.at - a.at).map((m) => m.key);

/** Rule ids reported to the model in this session, the latest first. */
export const markViolated = (dir, id) => touch(dir, 'violated', id);
export const recentViolations = (dir) => newestFirst(dir, 'violated');

/** File roles in the order the session first wrote them, the latest first. */
export const markRoleSeen = (dir, role) => touch(dir, 'roleSeen', role);
export const recentRoles = (dir) => newestFirst(dir, 'roleSeen');
