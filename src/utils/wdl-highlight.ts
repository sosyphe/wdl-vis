import hljs from 'highlight.js/lib/core'
import type { LanguageFn } from 'highlight.js'

const wdlLanguage: LanguageFn = () => ({
  name: 'WDL',
  keywords: {
    keyword: 'workflow task call if else then scatter input output runtime meta parameter_meta',
    type: 'String Int Float File Boolean Array Map Pair Object',
    literal: 'true false null',
  },
  contains: [
    hljs.COMMENT('#', '$'),
    hljs.QUOTE_STRING_MODE,
    {
      className: 'string',
      begin: /<<</, end: />>>/,
    },
    hljs.C_NUMBER_MODE,
    {
      className: 'variable',
      begin: /\$\{/, end: /\}/,
      contains: [hljs.QUOTE_STRING_MODE],
    },
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
})

hljs.registerLanguage('wdl', wdlLanguage)

export { hljs }
