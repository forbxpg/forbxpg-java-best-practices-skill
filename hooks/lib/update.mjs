// Update notice: where forbxpg-java was installed from, and whether a newer release tag exists there.
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

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
