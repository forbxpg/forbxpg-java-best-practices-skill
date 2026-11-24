// User install: the agents' own CLIs register this folder once for all projects.
import { spawnSync } from 'node:child_process';

/** Default runner; .cmd shims (gigacode.cmd, claude.cmd) need a shell on Windows. */
export function runCommand(cmd, args, { input } = {}) {
  const r = spawnSync(cmd, args, { input, encoding: 'utf8', shell: process.platform === 'win32', windowsHide: true });
  return { status: r.status ?? 1, output: `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? String(r.error) : ''}` };
}

function steps(repoDir, agent, uninstall) {
  if (agent === 'gigacode') {
    // `link` asks "Do you want to continue? [Y/n]" and silently installs nothing without an answer.
    return uninstall
      ? [['gigacode', ['extensions', 'uninstall', 'forbxpg-java']]]
      : [['gigacode', ['extensions', 'link', repoDir], 'Y\n']];
  }
  if (agent === 'claude') {
    return uninstall
      ? [['claude', ['plugin', 'uninstall', 'forbxpg-java@forbxpg-java']], ['claude', ['plugin', 'marketplace', 'remove', 'forbxpg-java']]]
      : [['claude', ['plugin', 'marketplace', 'add', repoDir]], ['claude', ['plugin', 'install', 'forbxpg-java@forbxpg-java']]];
  }
  throw new Error(`unknown agent "${agent}" (expected: gigacode, claude)`);
}

/** Runs the agent's install or uninstall commands; returns the commands run. Throws on the first failure. */
export function installUser({ repoDir, agent, uninstall = false }, run = runCommand) {
  const done = [];
  for (const [cmd, args, input] of steps(repoDir, agent, uninstall)) {
    const line = `${cmd} ${args.join(' ')}`;
    const { status, output } = run(cmd, args, { input });
    if (status !== 0) throw new Error(`${line} failed (exit ${status}):\n${output.trim()}`);
    done.push(line);
  }
  return done;
}
