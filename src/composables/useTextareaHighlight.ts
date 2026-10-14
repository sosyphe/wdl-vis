// The DOM-free locators moved to src/parser/locate.ts so editor integrations can
// reuse them without pulling in browser-only code. Re-exported here for
// backwards compatibility with existing import paths.
export { findTaskBlock, findCallBlock } from '../parser/locate'
export type { BlockRange } from '../parser/locate'

import { findTaskBlock, findCallBlock } from '../parser/locate'

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
