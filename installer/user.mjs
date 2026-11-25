// User install: the agents' own CLIs register this folder once for all projects.
import { spawnSync } from 'node:child_process';

/**
 * Quote one cmd.exe argument. Node's shell:true joins argv with spaces and does not quote them.
 * cmd.exe expands %NAME% even inside quotes and has no escape for it on a /c command line, so an
 * argument with % is refused rather than passed on changed.
 */
export function quoteForCmd(arg) {
  const text = String(arg);
  if (text.includes('%')) {
    throw new Error(`argument contains % and cmd.exe would expand it: ${text}\nrun it by hand, or move the folder to a path without %`);
  }
  if (text === '') return '""';
  if (!/[\s"&<>|^]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

/** One cmd.exe command line. Each argument that needs it is a single quoted token. */
export function windowsCommandLine(cmd, args) {
  return [cmd, ...args].map(quoteForCmd).join(' ');
}

/** Spawn arguments for one command. `platform` is injectable so the Windows branch can run in tests. */
export function commandSpec(cmd, args, platform = process.platform) {
  if (platform === 'win32') {
    return {
      file: process.env.ComSpec || 'cmd.exe',
      // /s strips exactly the first and last quote: wrap the whole line once so a quoted command path survives.
      args: ['/d', '/s', '/c', `"${windowsCommandLine(cmd, args)}"`],
      windowsVerbatimArguments: true,
    };
  }
  return { file: cmd, args, windowsVerbatimArguments: false };
}

/**
 * Runs a command. On Windows, .cmd shims need cmd.exe; arguments are quoted so a
 * repository path with spaces stays one argument. POSIX passes the array through.
 */
export function runCommand(cmd, args, { input, platform = process.platform, spawn = spawnSync } = {}) {
  const spec = commandSpec(cmd, args, platform);
  const r = spawn(spec.file, spec.args, {
    input,
    encoding: 'utf8',
    windowsHide: true,
    windowsVerbatimArguments: spec.windowsVerbatimArguments,
  });
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
