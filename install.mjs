#!/usr/bin/env node
// forbxpg-java installer: node install.mjs --agent gigacode|claude --scope user|project [options]
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installProject, uninstallProject } from './installer/project.mjs';
import { installUser } from './installer/user.mjs';
import { join } from 'node:path';
import { installSource, runCheck, checkRemote, newer, pullCommand } from './hooks/lib/update.mjs';
import { installStyle, uninstallStyle, previewStyle } from './installer/style.mjs';
import { homedir } from 'node:os';

const REPO = dirname(fileURLToPath(import.meta.url));

const HELP = `forbxpg-java installer

  node install.mjs --agent <gigacode|claude> --scope <user|project> [options]

Options
  --project <dir>   project folder for --scope project (default: current folder)
  --update          re-install over a previous install (files changed in the project are kept)
  --force           with --update: also replace files changed in the project
  --uninstall       remove exactly what the install wrote (from its receipt)
  --dry-run         print the plan, change nothing
  --check           compare this clone's version with the newest release tag on its remote
  --gigacode-style  the forbxpg look for GigaCode in ~/.gigacode: status line, theme, banner,
                    loading phrases (with --dark, --force, --dry-run, --uninstall,
                    --preview to see it first)
  --help            this text

User scope registers this folder with the agent's own CLI (gigacode extensions link;
claude plugin marketplace add + plugin install); git pull in this folder updates it.

Project scope copies skills and hooks into the repository (.gigacode/ or .claude/), merges
the hooks into the agent's settings.json and writes install-receipt.json. Commit the result
so the whole team gets it. Each developer approves the project hooks once in the agent.`;

function parse(argv) {
  const opts = { agent: null, scope: null, project: process.cwd(), update: false, force: false, uninstall: false, dryRun: false, check: false, help: false, style: false, dark: false, preview: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--agent') opts.agent = argv[++i];
    else if (a === '--scope') opts.scope = argv[++i];
    else if (a === '--project') opts.project = resolve(argv[++i]);
    else if (a === '--update') opts.update = true;
    else if (a === '--force') opts.force = true;
    else if (a === '--uninstall') opts.uninstall = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--check') opts.check = true;
    else if (a === '--gigacode-style') opts.style = true;
    else if (a === '--dark') opts.dark = true;
    else if (a === '--preview') opts.preview = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else throw new Error(`unknown option ${a}`);
  }
  return opts;
}

function report(title, result) {
  console.log(title);
  console.log(`  written: ${result.written.length} file(s)`);
  for (const f of result.skipped) console.log(`  kept (changed in the project): ${f}`);
  for (const f of result.removed) console.log(`  removed: ${f}`);
}

/** --gigacode-style: the forbxpg look in ~/.gigacode/settings.json. */
function style(opts) {
  const homeDir = homedir();
  if (opts.uninstall) {
    const r = uninstallStyle({ homeDir, dryRun: opts.dryRun });
    if (r.missing) {
      console.log('The forbxpg look is not installed (no ~/.gigacode/forbxpg-java-style.json).');
      return 0;
    }
    console.log(`${opts.dryRun ? 'Would restore' : 'forbxpg look removed; restored'}: ${r.restored.join(', ') || 'nothing'}`);
    for (const k of r.kept) console.log(`  kept ui.${k}: you changed it after the install`);
    return 0;
  }
  const r = installStyle({ repoDir: REPO, homeDir, dark: opts.dark, force: opts.force, dryRun: opts.dryRun });
  if (r.conflicts.length > 0 && !opts.force) {
    console.log(`Not installed: ~/.gigacode/settings.json already sets ${r.conflicts.map((k) => `ui.${k}`).join(', ')}.`);
    console.log('Run again with --force to replace them; --gigacode-style --uninstall puts them back.');
    return 1;
  }
  if (r.written.length === 0) console.log('The forbxpg look is already installed.');
  else console.log(`${opts.dryRun ? 'Would set' : 'forbxpg look installed; set'}: ${r.written.map((k) => `ui.${k}`).join(', ')}`);
  if (!opts.dryRun && r.written.length > 0) console.log('Open a new GigaCode session. Undo: node install.mjs --gigacode-style --uninstall');
  return 0;
}

/** --check: installed version of this clone against the newest vX.Y.Z tag on its origin. */
function check() {
  const source = installSource(join(REPO, 'hooks', 'lib'));
  if (!source) {
    console.log('This folder is not a git clone with an origin remote; there is nothing to compare with.');
    return 1;
  }
  let result = runCheck(source.remote);
  if (result.skipped) result = checkRemote(source.remote);
  if (result.error) {
    console.log(`installed ${source.version}; could not read the release tags of ${source.remote}: ${result.error}`);
    return 1;
  }
  console.log(`installed ${source.version}, latest ${result.latest ?? 'none (no vX.Y.Z tags)'} (${source.remote})`);
  if (result.latest && newer(result.latest, source.version)) {
    const pull = pullCommand(source.cloneDir) ?? `git pull --ff-only in ${source.cloneDir}`;
    console.log(`update: ${pull}, then re-run install.mjs for project installs (--update)`);
  }
  return 0;
}

function main() {
  const opts = parse(process.argv.slice(2));
  if (opts.check) return check();
  if (opts.style && opts.preview) {
    console.log(previewStyle({ repoDir: REPO, color: process.stdout.isTTY && !process.env.NO_COLOR }));
    return 0;
  }
  if (opts.style) return style(opts);
  if (opts.help || !opts.agent || !opts.scope) {
    console.log(HELP);
    return opts.help ? 0 : 2;
  }
  if (opts.scope === 'user') {
    if (opts.dryRun) {
      console.log(`Would run the ${opts.agent} CLI to ${opts.uninstall ? 'remove' : 'register'} ${REPO}`);
      return 0;
    }
    for (const line of installUser({ repoDir: REPO, agent: opts.agent, uninstall: opts.uninstall })) console.log(`  ran: ${line}`);
    console.log(opts.uninstall ? 'Removed. Open a new session.' : 'Registered for all projects. Open a new agent session; update later with git pull in this folder.');
    return 0;
  }
  if (opts.scope !== 'project') throw new Error(`--scope must be user or project, got ${opts.scope}`);
  if (opts.uninstall) {
    report(`${opts.dryRun ? 'Would uninstall' : 'Uninstalled'} forbxpg-java (${opts.agent}) from ${opts.project}`, uninstallProject({ projectDir: opts.project, agent: opts.agent, dryRun: opts.dryRun }));
    return 0;
  }
  const result = installProject({ repoDir: REPO, projectDir: opts.project, agent: opts.agent, dryRun: opts.dryRun, force: opts.force });
  report(`${opts.dryRun ? 'Would install' : 'Installed'} forbxpg-java (${opts.agent}) into ${opts.project}`, result);
  if (!opts.dryRun) console.log('Next: commit the new files; open a new agent session and approve the project hooks.');
  return 0;
}

try {
  process.exitCode = main();
} catch (err) {
  console.error(`error: ${err.message}`);
  process.exitCode = 1;
}
