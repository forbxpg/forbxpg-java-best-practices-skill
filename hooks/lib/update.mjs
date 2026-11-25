// Update notice: where forbxpg-java was installed from, and whether a newer release tag exists there.
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, statSync, openSync, closeSync, realpathSync } from 'node:fs';
import { spawnSync, spawn as spawnAsync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Cuts user:password@ (or token@) out of an http(s) URL; other URLs are returned unchanged. */
export function stripCredentials(url) {
  return String(url).replace(/^(https?:\/\/)[^@/]+@/i, '$1');
}

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
};

/** The origin URL of a git work tree, or null. */
export function originOf(dir) {
  const r = spawnSync('git', ['-C', dir, 'remote', 'get-url', 'origin'], {
    encoding: 'utf8', timeout: 3000, windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  return r.status === 0 && r.stdout.trim() ? stripCredentials(r.stdout.trim()) : null;
}

/**
 * Where these hooks were installed from, given their hooks/lib folder:
 * a git clone (hooks/lib → ../../.git) or a project install (hooks/lib → ../../install-receipt.json).
 * null when neither tells a remote (marketplace copy, zip).
 */
export function installSource(hooksLibDir) {
  const home = resolve(hooksLibDir, '..', '..');
  const receipt = readJson(join(home, 'install-receipt.json'));
  if (receipt?.source?.remote && receipt.version) {
    return { kind: 'project', version: receipt.version, remote: receipt.source.remote, agent: receipt.agent };
  }
  if (!existsSync(join(home, '.git'))) return null;
  const version = readJson(join(home, '.claude-plugin', 'plugin.json'))?.version;
  const remote = originOf(home);
  return version && remote ? { kind: 'clone', version, remote, cloneDir: home } : null;
}

const SEMVER = /^v(\d+)\.(\d+)\.(\d+)$/;
const parts = (v) => String(v).replace(/^v/, '').split('.').map(Number);

/** true when version a is greater than version b (X.Y.Z, numeric). */
export function newer(a, b) {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i += 1) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  }
  return false;
}

/** Highest plain vX.Y.Z among tag names (refs/tags/ prefix allowed), as X.Y.Z; pre-releases ignored. */
export function latestTag(tags) {
  let best = null;
  for (const tag of tags) {
    const name = String(tag).replace(/^refs\/tags\//, '').trim();
    const m = name.match(SEMVER);
    if (!m) continue;
    const version = `${m[1]}.${m[2]}.${m[3]}`;
    if (!best || newer(version, best)) best = version;
  }
  return best;
}

export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const LOCK_TTL_MS = 60 * 1000;
const DEFAULT_CACHE_ROOT = () => join(tmpdir(), 'forbxpg-java', 'update-check');

/** One cache file per remote: { checkedAt, latest, error }. */
export function cacheFile(remote, { cacheRoot = DEFAULT_CACHE_ROOT() } = {}) {
  return join(cacheRoot, `${createHash('sha1').update(remote).digest('hex').slice(0, 16)}.json`);
}

export function readCache(remote, opts = {}) {
  return readJson(cacheFile(remote, opts));
}

export const isStale = (cache, now = Date.now()) => !cache || !Number.isFinite(cache.checkedAt) || now - cache.checkedAt > CHECK_INTERVAL_MS;

/**
 * `git ls-remote --tags` without prompts and with a hard timeout. Returns { latest, error }.
 * `git` is [command, ...prefixArgs] so tests can stand in a fake.
 */
export function checkRemote(remote, { git = ['git'], timeoutMs = 5000 } = {}) {
  const [cmd, ...prefix] = git;
  const r = spawnSync(cmd, [...prefix, 'ls-remote', '--tags', '--refs', remote], {
    encoding: 'utf8',
    timeout: timeoutMs,
    windowsHide: true,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never', GIT_ASKPASS: '', SSH_ASKPASS: '' },
  });
  if (r.error) return { latest: null, error: r.error.code === 'ETIMEDOUT' ? `timed out after ${timeoutMs} ms` : String(r.error.message) };
  if (r.signal) return { latest: null, error: `timed out (${r.signal})` };
  if (r.status !== 0) return { latest: null, error: (r.stderr || `git exited ${r.status}`).trim().split('\n')[0] };
  const tags = r.stdout.split(/\r?\n/).map((line) => line.split('\t')[1]).filter(Boolean);
  return { latest: latestTag(tags), error: null };
}

/** Takes the per-remote lock unless another check holds a fresh one. */
function takeLock(lock) {
  try {
    if (Date.now() - statSync(lock).mtimeMs < LOCK_TTL_MS) return false;
    rmSync(lock, { force: true });
  } catch {
    // no lock yet
  }
  try {
    closeSync(openSync(lock, 'wx'));
    return true;
  } catch {
    return false;
  }
}

/** Checks the remote once and writes the cache; never throws. */
export function runCheck(remote, opts = {}) {
  const file = cacheFile(remote, opts);
  const lock = `${file}.lock`;
  let locked = false;
  try {
    mkdirSync(dirname(file), { recursive: true });
    locked = takeLock(lock);
    if (!locked) return { skipped: 'locked' };
    const result = checkRemote(remote, opts);
    writeFileSync(file, JSON.stringify({ checkedAt: Date.now(), latest: result.latest, error: result.error }));
    return result;
  } catch (err) {
    return { latest: null, error: String(err?.message ?? err) };
  } finally {
    // Only our own lock: another process's lock means its check is still running.
    if (locked) rmSync(lock, { force: true });
  }
}

/** Starts `node update.mjs --check <remote>` detached and hidden; the session does not wait for it. */
export function spawnCheck(remote, spawn = spawnAsync) {
  try {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--check', remote], { detached: true, stdio: 'ignore', windowsHide: true });
    child.unref?.();
  } catch {
    // A check that cannot start is retried by the next session.
  }
}

/**
 * The update notice for this session, or null. Starts a background check when the cache is
 * missing or older than a day. Returns { context, user } texts.
 */
export function updateNotice({ hooksLibDir, cacheRoot, spawn } = {}) {
  const source = installSource(hooksLibDir);
  if (!source) return null;
  const cache = readCache(source.remote, cacheRoot ? { cacheRoot } : {});
  if (isStale(cache)) spawnCheck(source.remote, spawn);
  if (!cache?.latest || !newer(cache.latest, source.version)) return null;
  const versions = `${source.version} → ${cache.latest}`;
  const command = source.kind === 'clone'
    ? `git -C "${source.cloneDir}" pull --ff-only, then the user opens a new session`
    : `git pull in the user's forbxpg-java clone (ask them where it is), then node <clone>/install.mjs --agent ${source.agent ?? 'gigacode'} --scope project --update, and commit the result`;
  return {
    context: `[forbxpg-java] Update available: ${versions}.\nTell the user once, in one line. If they agree, run: ${command}. Do not run it without their yes.`,
    user: `forbxpg-java: update available ${versions}`,
  };
}

// Detached background run: node update.mjs --check <remote>
function isEntryPoint() {
  try {
    return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}
if (isEntryPoint() && process.argv[2] === '--check' && process.argv[3]) runCheck(process.argv[3]);
