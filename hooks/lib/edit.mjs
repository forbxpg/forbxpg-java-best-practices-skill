// Rebuilds the text an edit tool is about to write.

function replaceFirst(text, search, replacement) {
  const at = text.indexOf(search);
  return at < 0 ? text : text.slice(0, at) + replacement + text.slice(at + search.length);
}

/**
 * Applies old → new to `original`. Tolerates a LF old_string on a CRLF file.
 * When old_string is not found, returns `original` unchanged: the tool itself will fail.
 */
export function applyEdit(original, oldString, newString, replaceAll) {
  if (oldString === '') return original === '' ? newString : original;
  let search = oldString;
  let replacement = newString;
  if (!original.includes(search)) {
    const crlf = oldString.replace(/\r?\n/g, '\r\n');
    if (!original.includes(crlf)) return original;
    search = crlf;
    replacement = newString.replace(/\r?\n/g, '\r\n');
  }
  return replaceAll ? original.split(search).join(replacement) : replaceFirst(original, search, replacement);
}
