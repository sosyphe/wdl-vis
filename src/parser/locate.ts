// DOM-free source locators.
//
// The WDL AST (see ./ast.ts) deliberately carries no source positions, so any
// tooling that needs to map a parsed construct back onto the original text —
// editor integrations, "reveal in source" links, textarea highlighting — uses
// these offset-based helpers instead.
//
// All returned offsets are character indices into the exact string that was
// passed in: `start` is inclusive, `end` is exclusive.

export interface BlockRange {
  /** Inclusive character offset where the block starts. */
  start: number
  /** Exclusive character offset just past the block's closing brace. */
  end: number
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Given the index of an opening `{`, return the offset just past its matching
 * `}`, or -1 when the braces never balance.
 *
 * Note: the counter is intentionally naive — it does not skip `{`/`}` occurring
 * inside strings, comments or `command <<< >>>` bodies. This matches the
 * long-standing behaviour of `findTaskBlock`/`findCallBlock`; callers that need
 * exact block trees should scan tokens instead.
 */
function endOfBraceBlock(text: string, openBraceIndex: number): number {
  let depth = 0
  for (let i = openBraceIndex; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}') {
      depth--
      if (depth === 0) return i + 1
    }
  }
  return -1
}

/** Locate a `task <name> { ... }` definition. */
export function findTaskBlock(wdlText: string, taskName: string): BlockRange | null {
  const regex = new RegExp(`\\btask\\s+${escapeRegex(taskName)}\\s*\\{`)
  const match = regex.exec(wdlText)
  if (!match) return null

  const start = match.index
  const end = endOfBraceBlock(wdlText, match.index + match[0].length - 1)
  return end === -1 ? null : { start, end }
}

/**
 * Locate a `call <task> [as <alias>]` statement, including its `{ ... }` body
 * when it has one. A bare call with no body extends to the end of its line.
 */
export function findCallBlock(wdlText: string, taskName: string, callAlias?: string): BlockRange | null {
  const aliasPattern = callAlias && callAlias !== taskName
    ? `${escapeRegex(taskName)}\\s+as\\s+${escapeRegex(callAlias)}`
    : escapeRegex(taskName)
  const regex = new RegExp(`\\bcall\\s+${aliasPattern}\\s*(?=[{\\n\\r])`)
  const match = regex.exec(wdlText)
  if (!match) return null

  const start = match.index
  const afterMatch = match.index + match[0].length

  // If the call has a block body, find its closing brace
  const nextNonSpace = wdlText.slice(afterMatch).search(/\S/)
  if (nextNonSpace !== -1 && wdlText[afterMatch + nextNonSpace] === '{') {
    const end = endOfBraceBlock(wdlText, afterMatch + nextNonSpace)
    if (end !== -1) return { start, end }
  }

  // Bare call with no block — select to end of line
  const eol = wdlText.indexOf('\n', afterMatch)
  return { start, end: eol === -1 ? wdlText.length : eol }
}

/**
 * Locate a `workflow [<name>] { ... }` block. When `workflowName` is omitted the
 * first workflow in the document is returned.
 */
export function findWorkflowBlock(wdlText: string, workflowName?: string): BlockRange | null {
  const namePattern = workflowName
    ? `${escapeRegex(workflowName)}\\s*`
    : '(?:\\w+\\s*)?'
  const regex = new RegExp(`\\bworkflow\\b\\s*${namePattern}\\{`)
  const match = regex.exec(wdlText)
  if (!match) return null

  const start = match.index
  const end = endOfBraceBlock(wdlText, match.index + match[0].length - 1)
  return end === -1 ? null : { start, end }
}

/**
 * Locate the first `<keyword> { ... }` block whose header starts inside the
 * `[start, end)` window — e.g. the `input`/`output`/`runtime`/`command` block of
 * a task or workflow that was itself located with one of the helpers above.
 *
 * The window only constrains where the block may *start*; brace matching runs
 * against the full text, so a malformed window cannot truncate the result.
 * Keywords that take a colon instead of a brace (`input:` inside a `call`) are
 * not matched, which is what callers want.
 */
export function findBlockWithin(
  wdlText: string,
  start: number,
  end: number,
  keyword: string
): BlockRange | null {
  const from = Math.max(0, start)
  const to = Math.min(wdlText.length, end)
  if (from >= to) return null

  const regex = new RegExp(`\\b${escapeRegex(keyword)}\\s*\\{`)
  const match = regex.exec(wdlText.slice(from, to))
  if (!match) return null

  const blockStart = from + match.index
  const blockEnd = endOfBraceBlock(wdlText, blockStart + match[0].length - 1)
  return blockEnd === -1 ? null : { start: blockStart, end: blockEnd }
}
