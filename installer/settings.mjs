// settings.json handling for project installs: strict JSON in, our hook entries merged or removed.

const OURS = 'forbxpg-java';
const isOurs = (hook) => typeof hook?.command === 'string' && hook.command.includes(OURS);

/** Parses settings text; '' → {}. Comments or trailing commas are refused, never rewritten. */
export function parseSettings(text, path) {
  if (text.trim() === '') return {};
  try {
    const value = JSON.parse(text);
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  } catch {
    // fall through
  }
  throw new Error(`${path} is not plain JSON (comments or trailing commas?): merge the forbxpg-java hooks by hand or fix the file`);
}

export const formatSettings = (settings) => `${JSON.stringify(settings, null, 2)}\n`;

/** GigaCode writes "$version" into settings.json on its own; it is not the team's setting. */
const AGENT_KEYS = ['$version'];

export function withoutAgentKeys(settings) {
  const copy = { ...settings };
  for (const key of AGENT_KEYS) delete copy[key];
  return copy;
}

/** Settings without our hook entries; empty groups, events and the hooks key are dropped. */
export function removeHooks(settings) {
  const copy = structuredClone(settings);
  if (!copy.hooks || typeof copy.hooks !== 'object') return copy;
  for (const [event, groups] of Object.entries(copy.hooks)) {
    const kept = (Array.isArray(groups) ? groups : [])
      .map((g) => ({ ...g, hooks: (g.hooks ?? []).filter((h) => !isOurs(h)) }))
      .filter((g) => g.hooks.length > 0);
    if (kept.length > 0) copy.hooks[event] = kept;
    else delete copy.hooks[event];
  }
  if (Object.keys(copy.hooks).length === 0) delete copy.hooks;
  return copy;
}

/** Settings with our hook block added after the existing entries (any previous copy of ours removed). */
export function mergeHooks(settings, hooksBlock) {
  const copy = removeHooks(settings);
  copy.hooks = copy.hooks ?? {};
  for (const [event, groups] of Object.entries(hooksBlock)) {
    copy.hooks[event] = [...(copy.hooks[event] ?? []), ...structuredClone(groups)];
  }
  return copy;
}
