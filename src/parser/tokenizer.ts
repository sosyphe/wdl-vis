export const enum TokenType {
  KEYWORD = 'KEYWORD',
  IDENTIFIER = 'IDENTIFIER',
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  BOOL = 'BOOL',
  DOT = 'DOT',
  COMMA = 'COMMA',
  COLON = 'COLON',
  EQUALS = 'EQUALS',
  PLUS = 'PLUS',
  MINUS = 'MINUS',
  STAR = 'STAR',
  SLASH = 'SLASH',
  PERCENT = 'PERCENT',
  AMPAMP = 'AMPAMP',
  PIPEPIPE = 'PIPEPIPE',
  BANG = 'BANG',
  EQEQ = 'EQEQ',
  NEQ = 'NEQ',
  LT = 'LT',
  LTE = 'LTE',
  GT = 'GT',
  GTE = 'GTE',
  QUESTION = 'QUESTION',
  LBRACE = 'LBRACE',
  RBRACE = 'RBRACE',
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  LBRACKET = 'LBRACKET',
  RBRACKET = 'RBRACKET',
  BLOCK_CONTENT = 'BLOCK_CONTENT',
  HEREDOC = 'HEREDOC',
  EOF = 'EOF',
}

export const KEYWORDS = new Set([
  'workflow', 'task', 'call', 'if', 'else', 'scatter', 'in',
  'input', 'output', 'runtime', 'command', 'meta', 'parameter_meta',
  'as', 'import', 'struct', 'object', 'then',
])

export const TYPE_KEYWORDS = new Set([
  'String', 'Int', 'Float', 'File', 'Boolean', 'Array', 'Map', 'Pair', 'Object',
])

export interface Token {
  type: TokenType
  value: string
  line: number
  col: number
}

export class Tokenizer {
  private pos = 0
  private line = 1
  private col = 1
  private peeked: Token | null = null

  constructor(private src: string) {}

  peek(): Token {
    if (!this.peeked) this.peeked = this.readNext()
    return this.peeked
  }

  next(): Token {
    if (this.peeked) {
      const t = this.peeked
      this.peeked = null
      return t
    }
    return this.readNext()
  }

  private readNext(): Token {
    this.skipWhitespaceAndComments()
    if (this.pos >= this.src.length) return { type: TokenType.EOF, value: '', line: this.line, col: this.col }

    const line = this.line
    const col = this.col
    const ch = this.src[this.pos]

    if (ch === '"' || ch === "'") return this.readString(ch as '"' | "'", line, col)
    if (ch >= '0' && ch <= '9') return this.readNumber(line, col)
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
      return this.readIdentifierOrKeyword(line, col)
    }

    this.pos++; this.col++

    switch (ch) {
      case '.': return { type: TokenType.DOT, value: '.', line, col }
      case ',': return { type: TokenType.COMMA, value: ',', line, col }
      case ':': return { type: TokenType.COLON, value: ':', line, col }
      case '?': return { type: TokenType.QUESTION, value: '?', line, col }
      case '{': return { type: TokenType.LBRACE, value: '{', line, col }
      case '}': return { type: TokenType.RBRACE, value: '}', line, col }
      case '(': return { type: TokenType.LPAREN, value: '(', line, col }
      case ')': return { type: TokenType.RPAREN, value: ')', line, col }
      case '[': return { type: TokenType.LBRACKET, value: '[', line, col }
      case ']': return { type: TokenType.RBRACKET, value: ']', line, col }
      case '+': return { type: TokenType.PLUS, value: '+', line, col }
      case '-': return { type: TokenType.MINUS, value: '-', line, col }
      case '*': return { type: TokenType.STAR, value: '*', line, col }
      case '/': return { type: TokenType.SLASH, value: '/', line, col }
      case '%': return { type: TokenType.PERCENT, value: '%', line, col }
      case '!':
        if (this.src[this.pos] === '=') { this.pos++; this.col++; return { type: TokenType.NEQ, value: '!=', line, col } }
        return { type: TokenType.BANG, value: '!', line, col }
      case '=':
        if (this.src[this.pos] === '=') { this.pos++; this.col++; return { type: TokenType.EQEQ, value: '==', line, col } }
        return { type: TokenType.EQUALS, value: '=', line, col }
      case '<':
        if (this.src[this.pos] === '<' && this.src[this.pos + 1] === '<') {
          this.pos += 2; this.col += 2
          return this.readHeredoc(line, col)
        }
        if (this.src[this.pos] === '=') { this.pos++; this.col++; return { type: TokenType.LTE, value: '<=', line, col } }
        return { type: TokenType.LT, value: '<', line, col }
      case '>':
        if (this.src[this.pos] === '=') { this.pos++; this.col++; return { type: TokenType.GTE, value: '>=', line, col } }
        return { type: TokenType.GT, value: '>', line, col }
      case '&':
        if (this.src[this.pos] === '&') { this.pos++; this.col++; return { type: TokenType.AMPAMP, value: '&&', line, col } }
        return { type: TokenType.IDENTIFIER, value: '&', line, col }
      case '|':
        if (this.src[this.pos] === '|') { this.pos++; this.col++; return { type: TokenType.PIPEPIPE, value: '||', line, col } }
        return { type: TokenType.IDENTIFIER, value: '|', line, col }
      default:
        // skip unknown
        return this.readNext()
    }
  }

  private skipWhitespaceAndComments() {
    while (this.pos < this.src.length) {
      const ch = this.src[this.pos]
      if (ch === ' ' || ch === '\t' || ch === '\r') {
        this.pos++; this.col++
      } else if (ch === '\n') {
        this.pos++; this.line++; this.col = 1
      } else if (ch === '#') {
        while (this.pos < this.src.length && this.src[this.pos] !== '\n') this.pos++
      } else {
        break
      }
    }
  }

  private readIdentifierOrKeyword(line: number, col: number): Token {
    let val = ''
    while (this.pos < this.src.length) {
      const c = this.src[this.pos]
      if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c === '_') {
        val += c; this.pos++; this.col++
      } else break
    }
    if (val === 'true' || val === 'false') return { type: TokenType.BOOL, value: val, line, col }
    if (KEYWORDS.has(val) || TYPE_KEYWORDS.has(val)) return { type: TokenType.KEYWORD, value: val, line, col }
    return { type: TokenType.IDENTIFIER, value: val, line, col }
  }

  private readString(quote: '"' | "'", line: number, col: number): Token {
    this.pos++; this.col++ // consume opening quote
    let val = ''
    while (this.pos < this.src.length) {
      const c = this.src[this.pos]
      if (c === quote) { this.pos++; this.col++; break }
      if (c === '\\') {
        this.pos++; this.col++
        const escaped = this.src[this.pos] ?? ''
        val += '\\' + escaped
        if (escaped === '\n') { this.line++; this.col = 1 } else this.col++
        this.pos++
      } else {
        if (c === '\n') { this.line++; this.col = 1 } else this.col++
        val += c; this.pos++
      }
    }
    return { type: TokenType.STRING, value: val, line, col }
  }

  private readNumber(line: number, col: number): Token {
    let val = ''
    while (this.pos < this.src.length && (this.src[this.pos] >= '0' && this.src[this.pos] <= '9')) {
      val += this.src[this.pos++]; this.col++
    }
    if (this.src[this.pos] === '.') {
      val += '.'; this.pos++; this.col++
      while (this.pos < this.src.length && (this.src[this.pos] >= '0' && this.src[this.pos] <= '9')) {
        val += this.src[this.pos++]; this.col++
      }
    }
    return { type: TokenType.NUMBER, value: val, line, col }
  }

  private readHeredoc(line: number, col: number): Token {
    // consume past <<<, read until >>>
    let content = ''
    while (this.pos < this.src.length) {
      if (this.src[this.pos] === '>' && this.src[this.pos + 1] === '>' && this.src[this.pos + 2] === '>') {
        this.pos += 3; this.col += 3
        break
      }
      if (this.src[this.pos] === '\n') { this.line++; this.col = 1 } else this.col++
      content += this.src[this.pos++]
    }
    return { type: TokenType.HEREDOC, value: content, line, col }
  }

  /** Read the raw content of a command { ... } block (handles nested braces) */
  readCommandBlock(): string {
    // current token should be LBRACE, already consumed
    let depth = 1
    let content = ''
    while (this.pos < this.src.length && depth > 0) {
      const c = this.src[this.pos]
      // Skip over ${...} interpolations so their } doesn't affect depth
      if (c === '$' && this.src[this.pos + 1] === '{') {
        content += c; this.pos++; this.col++
        content += '{'; this.pos++; this.col++
        let interp = 1
        while (this.pos < this.src.length && interp > 0) {
          const ic = this.src[this.pos]
          if (ic === '{') interp++
          else if (ic === '}') interp--
          if (ic === '\n') { this.line++; this.col = 1 } else this.col++
          if (interp > 0) content += ic
          this.pos++
        }
        content += '}'
        continue
      }
      if (c === '{') depth++
      else if (c === '}') { depth--; if (depth === 0) { this.pos++; this.col++; break } }
      if (c === '\n') { this.line++; this.col = 1 } else this.col++
      content += c; this.pos++
    }
    return content
  }
}
