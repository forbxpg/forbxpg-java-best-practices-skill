// Java source helpers that keep positions: comments and literal contents become spaces.

/**
 * Replaces comment text and the contents of string, text-block and char literals with spaces.
 * Quote characters, line breaks and the overall length are kept, so indices still line up.
 */
export function stripCommentsAndStrings(text) {
  const out = [];
  const n = text.length;
  const blank = (ch) => (ch === '\n' || ch === '\r' ? ch : ' ');
  let i = 0;
  while (i < n) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '/' && next === '/') {
      while (i < n && text[i] !== '\n') out.push(blank(text[i++]));
    } else if (ch === '/' && next === '*') {
      out.push(' ', ' ');
      i += 2;
      while (i < n && !(text[i] === '*' && text[i + 1] === '/')) out.push(blank(text[i++]));
      if (i < n) {
        out.push(' ', ' ');
        i += 2;
      }
    } else if (text.startsWith('"""', i)) {
      out.push('"', '"', '"');
      i += 3;
      while (i < n && !text.startsWith('"""', i)) {
        if (text[i] === '\\') out.push(blank(text[i++]));
        if (i < n) out.push(blank(text[i++]));
      }
      if (i < n) {
        out.push('"', '"', '"');
        i += 3;
      }
    } else if (ch === '"' || ch === "'") {
      out.push(ch);
      i += 1;
      while (i < n && text[i] !== ch && text[i] !== '\n') {
        if (text[i] === '\\') out.push(blank(text[i++]));
        if (i < n) out.push(blank(text[i++]));
      }
      if (i < n && text[i] === ch) out.push(text[i++]);
    } else {
      out.push(ch);
      i += 1;
    }
  }
  return out.join('');
}
