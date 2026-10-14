import hljs from 'highlight.js/lib/core'
import type { LanguageFn, Mode } from 'highlight.js'

const wdlLanguage: LanguageFn = () => {
  // Placeholders (`~{…}` / `${…}`) and double-quoted strings are mutually
  // recursive: placeholders sit inside strings (`echo "~{name}"`) and strings
  // sit inside placeholders (`~{default="x"}`). hljs compiles modes lazily on
  // the first highlight() call, so wiring the cycle after both objects exist
  // is safe.
  //
  // The previous bare hljs.QUOTE_STRING_MODE had no `contains`, so a line like
  // `echo "Hello, ~{greeting}!"` was emitted as ONE string span, and WDL's
  // `~{…}` form was never recognised at all (only `${…}` was).
  const placeholder: Mode = {
    className: 'variable',
    begin: /[~$]\{/,
    end: /\}/,
    contains: [],
  }
  const quotedString: Mode = {
    className: 'string',
    begin: /"/,
    end: /"/,
    // BACKSLASH_ESCAPE keeps `\"` from ending the string early.
    contains: [hljs.BACKSLASH_ESCAPE, placeholder],
  }
  placeholder.contains = [quotedString]

  return {
    name: 'WDL',
    keywords: {
      keyword: 'workflow task call if else then scatter input output runtime meta parameter_meta',
      type: 'String Int Float File Boolean Array Map Pair Object',
      literal: 'true false null',
    },
    contains: [
      hljs.COMMENT('#', '$'),
      quotedString,
      // Also top-level: command text carries placeholders outside any quotes
      // (`awk '{print $1}' ~{reads}`), and the inspector only ever sees the
      // inner text of a command (heredoc delimiters stripped by the parser).
      placeholder,
      {
        className: 'string',
        begin: /<<</, end: />>>/,
        contains: [placeholder],
      },
      hljs.C_NUMBER_MODE,
      {
        // task/workflow/call names
        begin: /\b(task|workflow|call)\s+/,
        end: /\s/,
        returnBegin: true,
        contains: [
          { className: 'keyword', begin: /\b(task|workflow|call)\b/ },
          { className: 'title', begin: /\w+/ },
        ],
      },
    ],
  }
}

hljs.registerLanguage('wdl', wdlLanguage)

export { hljs }
