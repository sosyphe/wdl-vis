// highlight.js WDL language used by the inspector's SCRIPT snippet.
//
// The regression that motivates most of these: a bare QUOTE_STRING_MODE has no
// `contains`, so `echo "Hello, ~{greeting}!"` used to be emitted as ONE
// `.hljs-string` chunk (near-black at 12px), and WDL's `~{…}` placeholder form
// was never recognised at all — only `${…}` was.

import { describe, it, expect } from 'vitest'
import { hljs } from '../src/utils/wdl-highlight'

const hl = (code: string) => hljs.highlight(code, { language: 'wdl' }).value

describe('wdl highlight — placeholders', () => {
  it('highlights ~{x} as a variable', () => {
    expect(hl('~{x}')).toContain('<span class="hljs-variable">~{x}</span>')
  })

  it('still highlights the ${x} form (regression)', () => {
    expect(hl('${x}')).toContain('<span class="hljs-variable">${x}</span>')
  })

  it('highlights placeholders inside double-quoted strings', () => {
    const value = hl('echo "Hello, ~{greeting}! (iteration ~{index})"')
    expect(value).toContain('<span class="hljs-variable">~{greeting}</span>')
    expect(value).toContain('<span class="hljs-variable">~{index}</span>')
    // The placeholders are their own spans nested in the string — the old
    // single-chunk output kept them contiguous plain text inside one span.
    expect(value).toContain('<span class="hljs-string">&quot;Hello, <span')
    expect(value).not.toContain('Hello, ~{greeting}')
    expect(value.match(/hljs-variable/g)).toHaveLength(2)
  })

  it('highlights placeholders inside <<< >>> heredocs', () => {
    const value = hl('<<<\necho ~{x}\n>>>')
    expect(value).toContain('hljs-string')
    expect(value).toContain('<span class="hljs-variable">~{x}</span>')
  })

  it('highlights strings nested inside a placeholder', () => {
    expect(hl('~{default="y"}')).toContain('<span class="hljs-string">&quot;y&quot;</span>')
  })

  it('does not let an escaped quote end the string before a placeholder', () => {
    const value = hl(String.raw`"a\"b ~{x}"`)
    expect(value).toContain('<span class="hljs-variable">~{x}</span>')
  })

  it('leaves single-quoted shell text alone', () => {
    const value = hl("awk '{print $1}' ~{reads}")
    expect(value).not.toContain('hljs-string')
    expect(value.match(/hljs-variable/g)).toHaveLength(1)
    expect(value).toContain('<span class="hljs-variable">~{reads}</span>')
  })
})
