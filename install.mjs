#!/usr/bin/env node
// forbxpg-java installer: node install.mjs --agent gigacode|claude --scope user|project [options]
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installProject, uninstallProject } from './installer/project.mjs';
import { installUser } from './installer/user.mjs';

const REPO = dirname(fileURLToPath(import.meta.url));

const HELP = `forbxpg-java installer

  node install.mjs --agent <gigacode|claude> --scope <user|project> [options]

Options
  --project <dir>   project folder for --scope project (default: current folder)
  --update          re-install over a previous install (files changed in the project are kept)
  --force           with --update: also replace files changed in the project
  --uninstall       remove exactly what the install wrote (from its receipt)
  --dry-run         print the plan, change nothing
  --help            this text

User scope registers this folder with the agent's own CLI (gigacode extensions link;
claude plugin marketplace add + plugin install); git pull in this folder updates it.

Project scope copies skills and hooks into the repository (.gigacode/ or .claude/), merges
the hooks into the agent's settings.json and writes install-receipt.json. Commit the result
so the whole team gets it. Each developer approves the project hooks once in the agent.`;

function parse(argv) {
  const opts = { agent: null, scope: null, project: process.cwd(), update: false, force: false, uninstall: false, dryRun: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--agent') opts.agent = argv[++i];
    else if (a === '--scope') opts.scope = argv[++i];
    else if (a === '--project') opts.project = resolve(argv[++i]);
    else if (a === '--update') opts.update = true;
    else if (a === '--force') opts.force = true;
    else if (a === '--uninstall') opts.uninstall = true;
    else if (a === '--dry-run') opts.dryRun = true;
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

function main() {
  const opts = parse(process.argv.slice(2));
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
    report(`Uninstalled forbxpg-java (${opts.agent}) from ${opts.project}`, uninstallProject({ projectDir: opts.project, agent: opts.agent }));
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
