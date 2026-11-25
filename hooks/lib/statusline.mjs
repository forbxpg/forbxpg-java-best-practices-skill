// Status line for GigaCode: one line from the harness input and the state the hooks keep.
import { newer } from './update.mjs';

const SEP = ' · ';
const ANSI = { red: 31, green: 32, yellow: 33 };
// Dropped first to last when the terminal is too narrow; model, ctx and build always stay.
const DROP_ORDER = ['compact', 'branch', 'fj', 'rules', 'passport'];

const paint = (color, name, text) => (color ? `\x1b[${ANSI[name]}m${text}\x1b[0m` : text);

function contextSegment(pct, warnAt, color) {
  if (!Number.isFinite(pct)) return null;
  const value = Math.max(0, Math.min(100, Math.round(pct)));
  const filled = Math.round(value / 10);
  const text = `ctx [${'#'.repeat(filled)}${'-'.repeat(10 - filled)}] ${value}%`;
  // 85% is GigaCode's auto-compaction threshold; warnAt is when Stop asks for a handoff note.
  if (value >= 85) return { plain: `${text} !!`, colored: `${text} ${paint(color, 'red', '!!')}` };
  if (value >= warnAt * 100) return { plain: `${text} !`, colored: `${text} ${paint(color, 'yellow', '!')}` };
  return { plain: text, colored: text };
}

function buildSegment(build, now, color) {
  if (!build?.result) return null;
  if (build.result === 'fail') return { plain: 'build FAIL', colored: `build ${paint(color, 'red', 'FAIL')}` };
  if (build.result !== 'ok') return { plain: 'build ?', colored: `build ${paint(color, 'yellow', '?')}` };
  const minutes = Math.floor((now - Number(build.at)) / 60_000);
  const age = Number.isFinite(minutes) && minutes >= 1 ? `${minutes}m` : '<1m';
  return { plain: `build ok ${age}`, colored: `build ${paint(color, 'green', 'ok')} ${age}` };
}

const same = (text) => (text ? { plain: text, colored: text } : null);

/**
 * One status line. input: GigaCode's status line JSON; data: { passport, build, rules,
 * compactions, update } read from the hooks' state. Segments without data are left out.
 */
export function renderStatusLine(input, data, { color = false, width, warnAt = 0.7, now = Date.now() } = {}) {
  const p = data.passport;
  const passport = p ? [p.java && `Java ${p.java}`, p.boot && `Boot ${String(p.boot).split('.').slice(0, 2).join('.')}`].filter(Boolean).join(SEP) : '';
  const update = data.update?.latest && data.update.installed && newer(data.update.latest, data.update.installed) ? data.update : null;
  const segments = [
    ['model', same(input?.model?.display_name ?? input?.model?.id)],
    ['branch', same(input?.git?.branch)],
    ['ctx', contextSegment(Number(input?.context_window?.used_percentage ?? NaN), warnAt, color)],
    ['passport', same(passport)],
    ['build', buildSegment(data.build, now, color)],
    ['rules', same(data.rules?.length ? `rules ${data.rules.slice(0, 4).join(' ')}` : '')],
    ['compact', same(data.compactions > 0 ? `compact x${data.compactions}` : '')],
    ['fj', update && { plain: `fj ${update.installed} (${update.latest} available)`, colored: `fj ${update.installed} (${update.latest} ${paint(color, 'yellow', 'available')})` }],
  ].filter(([, s]) => s);

  const plainLength = (list) => list.map(([, s]) => s.plain).join(SEP).length;
  let shown = segments;
  if (Number.isFinite(width) && width > 0) {
    for (const key of DROP_ORDER) {
      if (plainLength(shown) <= width) break;
      shown = shown.filter(([k]) => k !== key);
    }
  }
  return shown.map(([, s]) => s.colored).join(SEP);
}
