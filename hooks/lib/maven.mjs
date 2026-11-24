// Maven helpers for the Stop hook: the compile command, running it, reading compiler errors.
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

/**
 * One offline, quiet compile for the given modules (relative paths, '' = root) and what they need.
 * Uses the wrapper when present; on Windows the .cmd needs a shell.
 */
export function mavenCommand(projectDir, modules, platform) {
  const win = platform === 'win32';
  let cmd = 'mvn';
  if (win && existsSync(join(projectDir, 'mvnw.cmd'))) cmd = 'mvnw.cmd';
  else if (!win && existsSync(join(projectDir, 'mvnw'))) cmd = './mvnw';
  const list = [...new Set(modules.map((m) => m.replace(/\\/g, '/')))];
  const select = list.length === 0 || list.includes('') || list.includes('.') ? [] : ['-pl', list.join(','), '-am'];
  return { cmd, args: ['-q', '-o', ...select, 'compile'], shell: win, cwd: projectDir };
}

/** Kills the process and everything it started (cmd.exe → mvn → java on Windows). */
function killTree(child) {
  try {
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    else process.kill(-child.pid, 'SIGKILL');
  } catch {
    try {
      child.kill('SIGKILL');
    } catch {
      // Already gone.
    }
  }
}

/**
 * Runs a command and never rejects: { ok, output, timedOut }.
 * On timeout it resolves at once: a grandchild may keep the output pipe open long after the kill.
 */
export function runCompile(command, timeoutMs) {
  return new Promise((resolve) => {
    let output = '';
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      resolve(result);
    };
    let child;
    try {
      child = spawn(command.cmd, command.args, {
        cwd: command.cwd, shell: command.shell, windowsHide: true, detached: process.platform !== 'win32',
      });
    } catch (err) {
      finish({ ok: false, output: String(err), timedOut: false });
      return;
    }
    const timer = setTimeout(() => {
      killTree(child);
      finish({ ok: false, output, timedOut: true });
    }, timeoutMs);
    child.stdout?.on('data', (d) => { output += d; });
    child.stderr?.on('data', (d) => { output += d; });
    child.on('error', (err) => { output += String(err); });
    child.on('close', (code) => {
      clearTimeout(timer);
      finish({ ok: code === 0, output, timedOut: false });
    });
  });
}

const ERROR_LINE = /^\[ERROR\]\s+(.+?\.java):\[(\d+),\d+\]\s*(.*)$/gm;

export function parseCompileErrors(output) {
  return [...output.matchAll(ERROR_LINE)].map((m) => ({ file: m[1].trim(), line: Number(m[2]), message: m[3].trim() }));
}
