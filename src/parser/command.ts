/**
 * Normalize the raw text of a `command` section captured by the tokenizer.
 *
 * Removes exactly the artifacts of the delimiters, nothing else:
 *  - the newline terminating the opening line (`command <<<` / `command {`),
 *    together with any horizontal whitespace preceding it on that line;
 *  - if there is no leading newline (single-line form `command { echo hi }`),
 *    the delimiter's own leading spaces/tabs instead;
 *  - all trailing whitespace (the `}` / `>>>` closing line, e.g. `\n  `).
 *
 * Interior indentation and blank lines are preserved verbatim (no dedent).
 * Interior CRLF line endings are preserved; only a leading CRLF is consumed
 * as a unit.
 *
 * Internal detail — not re-exported from the parser's public API.
 */
export function normalizeCommand(raw: string): string {
  const withoutOpenerNewline = raw.replace(/^[ \t]*\r?\n/, '')
  const body =
    withoutOpenerNewline !== raw
      ? withoutOpenerNewline
      : raw.replace(/^[ \t]+/, '')
  return body.replace(/\s+$/, '')
}
