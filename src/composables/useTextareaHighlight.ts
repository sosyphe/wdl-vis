function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function findTaskBlock(wdlText: string, taskName: string): { start: number; end: number } | null {
  const regex = new RegExp(`\\btask\\s+${escapeRegex(taskName)}\\s*\\{`)
  const match = regex.exec(wdlText)
  if (!match) return null

  const start = match.index
  let depth = 0
  let i = match.index + match[0].length - 1

  for (; i < wdlText.length; i++) {
    if (wdlText[i] === '{') depth++
    else if (wdlText[i] === '}') {
      depth--
      if (depth === 0) return { start, end: i + 1 }
    }
  }
  return null
}

export function findCallBlock(wdlText: string, taskName: string, callAlias?: string): { start: number; end: number } | null {
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
    let depth = 0
    for (let i = afterMatch + nextNonSpace; i < wdlText.length; i++) {
      if (wdlText[i] === '{') depth++
      else if (wdlText[i] === '}') {
        depth--
        if (depth === 0) return { start, end: i + 1 }
      }
    }
  }

  // Bare call with no block — select to end of line
  const eol = wdlText.indexOf('\n', afterMatch)
  return { start, end: eol === -1 ? wdlText.length : eol }
}

// Measure the pixel offset of a character index inside a textarea by mirroring
// its styles into a hidden div and reading the caret position.
function measureCharOffsetTop(textarea: HTMLTextAreaElement, charIndex: number): number {
  const style = getComputedStyle(textarea)

  const mirror = document.createElement('div')
  mirror.style.cssText = [
    `position:fixed`, `top:0`, `left:-9999px`, `visibility:hidden`,
    `width:${textarea.clientWidth}px`,
    `padding:${style.padding}`,
    `border:${style.border}`,
    `font:${style.font}`,
    `font-size:${style.fontSize}`,
    `font-family:${style.fontFamily}`,
    `line-height:${style.lineHeight}`,
    `letter-spacing:${style.letterSpacing}`,
    `word-spacing:${style.wordSpacing}`,
    `tab-size:${style.tabSize}`,
    `white-space:${style.whiteSpace}`,
    `word-wrap:${style.wordWrap}`,
    `overflow-wrap:${style.overflowWrap}`,
    `box-sizing:${style.boxSizing}`,
  ].join(';')

  // Text before the target character, then a zero-width span as a marker
  const before = document.createTextNode(textarea.value.slice(0, charIndex))
  const marker = document.createElement('span')
  marker.textContent = '​' // zero-width space
  mirror.appendChild(before)
  mirror.appendChild(marker)

  document.body.appendChild(mirror)
  const markerTop = marker.offsetTop
  document.body.removeChild(mirror)

  return markerTop
}

export function useTextareaHighlight() {
  function highlightTaskBlock(textarea: HTMLTextAreaElement, wdlText: string, taskName: string, callAlias?: string) {
    const block = findTaskBlock(wdlText, taskName) ?? findCallBlock(wdlText, taskName, callAlias)
    if (!block) return

    textarea.focus()
    textarea.setSelectionRange(block.start, block.end)

    requestAnimationFrame(() => {
      const markerTop = measureCharOffsetTop(textarea, block.start)
      // Center the target line in the visible textarea
      const targetScrollTop = markerTop - textarea.clientHeight / 2
      textarea.scrollTop = Math.max(0, Math.min(targetScrollTop, textarea.scrollHeight))
    })
  }

  return { highlightTaskBlock }
}
