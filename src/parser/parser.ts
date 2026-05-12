import { Tokenizer, TokenType, type Token, TYPE_KEYWORDS } from './tokenizer'
import type {
  WdlDocument, WdlWorkflow, WdlTask, WdlDeclaration, WdlOutputDeclaration,
  WdlStatement, WdlCallStatement, WdlCallInput, WdlIfBlock, WdlScatterBlock,
  WdlType, WdlExpr
} from './ast'

export function parseWdl(src: string): WdlDocument {
  const parser = new WdlParser(src)
  return parser.parse()
}

class WdlParser {
  private tokenizer: Tokenizer
  private errors: string[] = []

  constructor(src: string) {
    this.tokenizer = new Tokenizer(src)
  }

  parse(): WdlDocument {
    const doc: WdlDocument = { workflow: null, tasks: [], errors: [] }
    while (this.peek().type !== TokenType.EOF) {
      try {
        const tok = this.peek()
        if (tok.type === TokenType.KEYWORD) {
          if (tok.value === 'workflow') {
            doc.workflow = this.parseWorkflow()
          } else if (tok.value === 'task') {
            doc.tasks.push(this.parseTask())
          } else if (tok.value === 'import') {
            this.skipLine()
          } else if (tok.value === 'struct') {
            this.skipToMatchingBrace()
          } else {
            this.next()
          }
        } else {
          this.next()
        }
      } catch (e) {
        this.errors.push(String(e))
        this.recoverToTopLevel()
      }
    }
    doc.errors = this.errors
    return doc
  }

  private parseWorkflow(): WdlWorkflow {
    this.expectKeyword('workflow')
    const name = this.expectIdentifier()
    this.expectToken(TokenType.LBRACE)

    const declarations: WdlDeclaration[] = []
    const body: WdlStatement[] = []
    const outputs: WdlOutputDeclaration[] = []

    while (!this.check(TokenType.RBRACE) && !this.check(TokenType.EOF)) {
      try {
        const tok = this.peek()
        if (tok.type === TokenType.KEYWORD && tok.value === 'output') {
          this.next()
          this.expectToken(TokenType.LBRACE)
          while (!this.check(TokenType.RBRACE) && !this.check(TokenType.EOF)) {
            try { outputs.push(this.parseOutputDeclaration()) } catch (e) { this.errors.push(String(e)); this.skipLine() }
          }
          this.expectToken(TokenType.RBRACE)
        } else if (tok.type === TokenType.KEYWORD && tok.value === 'input') {
          this.next()
          this.expectToken(TokenType.LBRACE)
          while (!this.check(TokenType.RBRACE) && !this.check(TokenType.EOF)) {
            try { declarations.push(this.parseDeclaration()) } catch (e) { this.errors.push(String(e)); this.skipLine() }
          }
          this.expectToken(TokenType.RBRACE)
        } else if (tok.type === TokenType.KEYWORD && tok.value === 'call') {
          body.push(this.parseCall())
        } else if (tok.type === TokenType.KEYWORD && tok.value === 'if') {
          body.push(this.parseIfBlock())
        } else if (tok.type === TokenType.KEYWORD && tok.value === 'scatter') {
          body.push(this.parseScatterBlock())
        } else if (tok.type === TokenType.KEYWORD && (tok.value === 'meta' || tok.value === 'parameter_meta')) {
          this.next(); this.skipToMatchingBrace()
        } else if (this.isTypeStart(tok)) {
          // workflow-level variable declaration
          declarations.push(this.parseDeclaration())
        } else {
          this.next()
        }
      } catch (e) {
        this.errors.push(String(e))
        this.skipLine()
      }
    }
    this.expectToken(TokenType.RBRACE)
    return { name, declarations, body, outputs }
  }

  private parseTask(): WdlTask {
    this.expectKeyword('task')
    const name = this.expectIdentifier()
    this.expectToken(TokenType.LBRACE)

    const inputs: WdlDeclaration[] = []
    let command = ''
    let commandStyle: 'brace' | 'heredoc' = 'brace'
    const outputs: WdlOutputDeclaration[] = []
    const runtime: Record<string, string> = {}
    const meta: Record<string, string> = {}

    while (!this.check(TokenType.RBRACE) && !this.check(TokenType.EOF)) {
      try {
        const tok = this.peek()
        if (tok.type === TokenType.KEYWORD && tok.value === 'command') {
          this.next()
          if (this.check(TokenType.HEREDOC)) {
            const t = this.next()
            command = t.value
            commandStyle = 'heredoc'
          } else if (this.check(TokenType.LBRACE)) {
            this.next()
            command = this.tokenizer.readCommandBlock()
            commandStyle = 'brace'
          } else if (this.peek().type === TokenType.LT) {
            // <<< is tokenized as LT LT LT — handle via readHeredocFallback
            const content = this.readHeredocManual()
            command = content
            commandStyle = 'heredoc'
          } else {
            this.skipLine()
          }
        } else if (tok.type === TokenType.KEYWORD && tok.value === 'input') {
          this.next()
          this.expectToken(TokenType.LBRACE)
          while (!this.check(TokenType.RBRACE) && !this.check(TokenType.EOF)) {
            try { inputs.push(this.parseDeclaration()) } catch (e) { this.errors.push(String(e)); this.skipLine() }
          }
          this.expectToken(TokenType.RBRACE)
        } else if (tok.type === TokenType.KEYWORD && tok.value === 'output') {
          this.next()
          this.expectToken(TokenType.LBRACE)
          while (!this.check(TokenType.RBRACE) && !this.check(TokenType.EOF)) {
            try { outputs.push(this.parseOutputDeclaration()) } catch (e) { this.errors.push(String(e)); this.skipLine() }
          }
          this.expectToken(TokenType.RBRACE)
        } else if (tok.type === TokenType.KEYWORD && tok.value === 'runtime') {
          this.next()
          this.expectToken(TokenType.LBRACE)
          while (!this.check(TokenType.RBRACE) && !this.check(TokenType.EOF)) {
            try {
              const key = this.expectIdentifierOrKeyword()
              this.expectToken(TokenType.COLON)
              const val = this.parseExpr()
              runtime[key] = this.exprToString(val)
              if (this.check(TokenType.COMMA)) this.next()
            } catch (e) { this.errors.push(String(e)); this.skipLine() }
          }
          this.expectToken(TokenType.RBRACE)
        } else if (tok.type === TokenType.KEYWORD && (tok.value === 'meta' || tok.value === 'parameter_meta')) {
          this.next(); this.skipToMatchingBrace()
        } else if (this.isTypeStart(tok)) {
          // draft-2 bare input
          inputs.push(this.parseDeclaration())
        } else {
          this.next()
        }
      } catch (e) {
        this.errors.push(String(e))
        this.skipLine()
      }
    }
    this.expectToken(TokenType.RBRACE)
    return { name, inputs, command, commandStyle, outputs, runtime, meta }
  }

  private parseCall(): WdlCallStatement {
    this.expectKeyword('call')
    // task name may be dotted: module.task
    let task = this.expectIdentifier()
    while (this.check(TokenType.DOT)) {
      this.next()
      task += '.' + this.expectIdentifier()
    }
    // Short task name without module prefix
    const shortTask = task.includes('.') ? task.split('.').pop()! : task

    let alias: string | null = null
    if (this.checkKeyword('as')) {
      this.next()
      alias = this.expectIdentifier()
    }
    const inputs: WdlCallInput[] = []
    if (this.check(TokenType.LBRACE)) {
      this.next()
      // optional 'input:' label
      if (this.checkKeyword('input')) {
        this.next()
        if (this.check(TokenType.COLON)) this.next()
      }
      while (!this.check(TokenType.RBRACE) && !this.check(TokenType.EOF)) {
        try {
          const param = this.expectIdentifierOrKeyword()
          this.expectToken(TokenType.EQUALS)
          const value = this.parseExpr()
          inputs.push({ param, value })
          if (this.check(TokenType.COMMA)) this.next()
        } catch (e) {
          this.errors.push(String(e)); this.skipLine()
        }
      }
      this.expectToken(TokenType.RBRACE)
    }
    return { kind: 'call', task: shortTask, alias, effectiveName: alias ?? shortTask, inputs }
  }

  private parseIfBlock(): WdlIfBlock {
    this.expectKeyword('if')
    this.expectToken(TokenType.LPAREN)
    const condition = this.parseExpr()
    this.expectToken(TokenType.RPAREN)
    this.expectToken(TokenType.LBRACE)
    const body = this.parseStatementBlock()
    this.expectToken(TokenType.RBRACE)
    return { kind: 'if', condition, body }
  }

  private parseScatterBlock(): WdlScatterBlock {
    this.expectKeyword('scatter')
    this.expectToken(TokenType.LPAREN)
    const variable = this.expectIdentifier()
    this.expectKeyword('in')
    const collection = this.parseExpr()
    this.expectToken(TokenType.RPAREN)
    this.expectToken(TokenType.LBRACE)
    const body = this.parseStatementBlock()
    this.expectToken(TokenType.RBRACE)
    return { kind: 'scatter', variable, collection, body }
  }

  private parseStatementBlock(): WdlStatement[] {
    const stmts: WdlStatement[] = []
    while (!this.check(TokenType.RBRACE) && !this.check(TokenType.EOF)) {
      try {
        const tok = this.peek()
        if (tok.type === TokenType.KEYWORD && tok.value === 'call') {
          stmts.push(this.parseCall())
        } else if (tok.type === TokenType.KEYWORD && tok.value === 'if') {
          stmts.push(this.parseIfBlock())
        } else if (tok.type === TokenType.KEYWORD && tok.value === 'scatter') {
          stmts.push(this.parseScatterBlock())
        } else if (this.isTypeStart(tok)) {
          // local variable declaration inside block
          this.parseDeclaration() // ignore for now
        } else {
          this.next()
        }
      } catch (e) {
        this.errors.push(String(e)); this.skipLine()
      }
    }
    return stmts
  }

  private parseDeclaration(): WdlDeclaration {
    const type = this.parseType()
    const name = this.expectIdentifier()
    let defaultValue: WdlExpr | null = null
    if (this.check(TokenType.EQUALS)) {
      this.next()
      defaultValue = this.parseExpr()
    }
    return { type, name, defaultValue }
  }

  private parseOutputDeclaration(): WdlOutputDeclaration {
    const type = this.parseType()
    const name = this.expectIdentifier()
    this.expectToken(TokenType.EQUALS)
    const value = this.parseExpr()
    return { type, name, value }
  }

  private parseType(): WdlType {
    const tok = this.peek()
    if (tok.type !== TokenType.KEYWORD || !TYPE_KEYWORDS.has(tok.value)) {
      // try identifier as type name
      if (tok.type === TokenType.IDENTIFIER) {
        this.next()
        const optional = this.check(TokenType.QUESTION) ? (this.next(), true) : false
        return { base: 'Unknown', optional }
      }
      throw new Error(`Expected type at line ${tok.line}:${tok.col}, got ${tok.value}`)
    }
    this.next()
    const base = tok.value as WdlType['base']

    if (base === 'Array') {
      this.expectToken(TokenType.LBRACKET)
      const itemType = this.parseType()
      this.expectToken(TokenType.RBRACKET)
      const optional = this.check(TokenType.QUESTION) ? (this.next(), true) : false
      const plus = this.check(TokenType.PLUS) ? (this.next(), true) : false
      void plus
      return { base: 'Array', itemType, optional }
    }
    if (base === 'Map') {
      this.expectToken(TokenType.LBRACKET)
      const keyType = this.parseType()
      this.expectToken(TokenType.COMMA)
      const valueType = this.parseType()
      this.expectToken(TokenType.RBRACKET)
      const optional = this.check(TokenType.QUESTION) ? (this.next(), true) : false
      return { base: 'Map', keyType, valueType, optional }
    }
    if (base === 'Pair') {
      this.expectToken(TokenType.LBRACKET)
      const leftType = this.parseType()
      this.expectToken(TokenType.COMMA)
      const rightType = this.parseType()
      this.expectToken(TokenType.RBRACKET)
      const optional = this.check(TokenType.QUESTION) ? (this.next(), true) : false
      return { base: 'Pair', leftType, rightType, optional }
    }
    const optional = this.check(TokenType.QUESTION) ? (this.next(), true) : false
    return { base: base as 'String' | 'Int' | 'Float' | 'File' | 'Boolean' | 'Object', optional }
  }

  // Expression parsing (simplified, handles the constructs present in the test WDL files)
  private parseExpr(): WdlExpr {
    return this.parseTernary()
  }

  private parseTernary(): WdlExpr {
    const left = this.parseOr()
    if (this.check(TokenType.QUESTION)) {
      this.next()
      const thenExpr = this.parseExpr()
      this.expectToken(TokenType.COLON)
      const elseExpr = this.parseExpr()
      return { kind: 'ternary', condition: left, then: thenExpr, else: elseExpr }
    }
    return left
  }

  private parseOr(): WdlExpr {
    let left = this.parseAnd()
    while (this.check(TokenType.PIPEPIPE)) {
      const op = this.next().value
      left = { kind: 'binary', op, left, right: this.parseAnd() }
    }
    return left
  }

  private parseAnd(): WdlExpr {
    let left = this.parseEquality()
    while (this.check(TokenType.AMPAMP)) {
      const op = this.next().value
      left = { kind: 'binary', op, left, right: this.parseEquality() }
    }
    return left
  }

  private parseEquality(): WdlExpr {
    let left = this.parseRelational()
    while (this.check(TokenType.EQEQ) || this.check(TokenType.NEQ)) {
      const op = this.next().value
      left = { kind: 'binary', op, left, right: this.parseRelational() }
    }
    return left
  }

  private parseRelational(): WdlExpr {
    let left = this.parseAdditive()
    while (this.check(TokenType.LT) || this.check(TokenType.LTE) || this.check(TokenType.GT) || this.check(TokenType.GTE)) {
      const op = this.next().value
      left = { kind: 'binary', op, left, right: this.parseAdditive() }
    }
    return left
  }

  private parseAdditive(): WdlExpr {
    let left = this.parseUnary()
    while (this.check(TokenType.PLUS) || this.check(TokenType.MINUS)) {
      const op = this.next().value
      left = { kind: 'binary', op, left, right: this.parseUnary() }
    }
    return left
  }

  private parseUnary(): WdlExpr {
    if (this.check(TokenType.BANG)) { this.next(); return { kind: 'not', operand: this.parsePrimary() } }
    if (this.check(TokenType.MINUS)) { this.next(); return { kind: 'binary', op: 'neg', left: { kind: 'number_literal', value: 0 }, right: this.parsePrimary() } }
    return this.parsePostfix()
  }

  private parsePostfix(): WdlExpr {
    let expr = this.parsePrimary()
    while (true) {
      if (this.check(TokenType.LBRACKET)) {
        this.next()
        const idx = this.parseExpr()
        this.expectToken(TokenType.RBRACKET)
        expr = { kind: 'index', array: expr, index: idx }
      } else if (this.check(TokenType.DOT)) {
        this.next()
        const field = this.expectIdentifier()
        // convert to output_ref if expr is identifier
        if (expr.kind === 'identifier') {
          expr = { kind: 'output_ref', call: expr.name, output: field }
        } else if (expr.kind === 'output_ref') {
          // triple dot: a.b.c — treat as output_ref with compound name
          expr = { kind: 'output_ref', call: expr.call + '.' + expr.output, output: field }
        } else {
          expr = { kind: 'identifier', name: field }
        }
      } else {
        break
      }
    }
    return expr
  }

  private parsePrimary(): WdlExpr {
    const tok = this.peek()

    if (tok.type === TokenType.STRING) {
      this.next()
      return { kind: 'string_literal', value: tok.value }
    }
    if (tok.type === TokenType.NUMBER) {
      this.next()
      return { kind: 'number_literal', value: parseFloat(tok.value) }
    }
    if (tok.type === TokenType.BOOL) {
      this.next()
      return { kind: 'bool_literal', value: tok.value === 'true' }
    }
    if (tok.type === TokenType.LPAREN) {
      this.next()
      const inner = this.parseExpr()
      this.expectToken(TokenType.RPAREN)
      return inner
    }
    if (tok.type === TokenType.LBRACKET) {
      return this.parseArrayLiteral()
    }
    if (tok.type === TokenType.KEYWORD && tok.value === 'object') {
      return this.parseObjectLiteral()
    }
    if (tok.type === TokenType.LBRACE) {
      return this.parseMapLiteral()
    }
    if (tok.type === TokenType.KEYWORD && tok.value === 'if') {
      this.next()
      const condition = this.parseExpr()
      this.expectKeyword('then')
      const thenExpr = this.parseExpr()
      this.expectKeyword('else')
      const elseExpr = this.parseExpr()
      return { kind: 'ternary', condition, then: thenExpr, else: elseExpr }
    }
    if (tok.type === TokenType.IDENTIFIER || tok.type === TokenType.KEYWORD) {
      this.next()
      // function call or identifier
      if (this.check(TokenType.LPAREN)) {
        return this.parseFunctionCall(tok.value)
      }
      return { kind: 'identifier', name: tok.value }
    }
    // fallback
    this.next()
    return { kind: 'unknown', raw: tok.value }
  }

  private parseFunctionCall(fn: string): WdlExpr {
    this.expectToken(TokenType.LPAREN)
    const args: WdlExpr[] = []
    while (!this.check(TokenType.RPAREN) && !this.check(TokenType.EOF)) {
      args.push(this.parseExpr())
      if (this.check(TokenType.COMMA)) this.next()
    }
    this.expectToken(TokenType.RPAREN)
    return { kind: 'call_expr', fn, args }
  }

  private parseArrayLiteral(): WdlExpr {
    this.expectToken(TokenType.LBRACKET)
    const elements: WdlExpr[] = []
    while (!this.check(TokenType.RBRACKET) && !this.check(TokenType.EOF)) {
      elements.push(this.parseExpr())
      if (this.check(TokenType.COMMA)) this.next()
    }
    this.expectToken(TokenType.RBRACKET)
    return { kind: 'array_literal', elements }
  }

  private parseObjectLiteral(): WdlExpr {
    // object { key: expr, ... }
    this.next() // consume 'object'
    this.expectToken(TokenType.LBRACE)
    const entries: { key: WdlExpr; value: WdlExpr }[] = []
    while (!this.check(TokenType.RBRACE) && !this.check(TokenType.EOF)) {
      const key = this.parseExpr()
      this.expectToken(TokenType.COLON)
      const value = this.parseExpr()
      entries.push({ key, value })
      if (this.check(TokenType.COMMA)) this.next()
    }
    this.expectToken(TokenType.RBRACE)
    return { kind: 'map_literal', entries }
  }

  private parseMapLiteral(): WdlExpr {
    this.expectToken(TokenType.LBRACE)
    const entries: { key: WdlExpr; value: WdlExpr }[] = []
    while (!this.check(TokenType.RBRACE) && !this.check(TokenType.EOF)) {
      const key = this.parseExpr()
      this.expectToken(TokenType.COLON)
      const value = this.parseExpr()
      entries.push({ key, value })
      if (this.check(TokenType.COMMA)) this.next()
    }
    this.expectToken(TokenType.RBRACE)
    return { kind: 'map_literal', entries }
  }

  // Helpers

  private peek(): Token { return this.tokenizer.peek() }
  private next(): Token { return this.tokenizer.next() }

  private check(type: TokenType): boolean {
    return this.peek().type === type
  }

  private checkKeyword(kw: string): boolean {
    const t = this.peek()
    return (t.type === TokenType.KEYWORD || t.type === TokenType.IDENTIFIER) && t.value === kw
  }

  private expectToken(type: TokenType): Token {
    const t = this.peek()
    if (t.type !== type) throw new Error(`Expected ${type} at line ${t.line}:${t.col}, got '${t.value}' (${t.type})`)
    return this.next()
  }

  private expectKeyword(kw: string): Token {
    const t = this.peek()
    if ((t.type !== TokenType.KEYWORD && t.type !== TokenType.IDENTIFIER) || t.value !== kw) {
      throw new Error(`Expected keyword '${kw}' at line ${t.line}:${t.col}, got '${t.value}'`)
    }
    return this.next()
  }

  private expectIdentifier(): string {
    const t = this.peek()
    if (t.type !== TokenType.IDENTIFIER && t.type !== TokenType.KEYWORD) {
      throw new Error(`Expected identifier at line ${t.line}:${t.col}, got '${t.value}'`)
    }
    this.next()
    return t.value
  }

  private expectIdentifierOrKeyword(): string {
    const t = this.peek()
    if (t.type !== TokenType.IDENTIFIER && t.type !== TokenType.KEYWORD) {
      throw new Error(`Expected identifier/keyword at line ${t.line}:${t.col}, got '${t.value}'`)
    }
    this.next()
    return t.value
  }

  private isTypeStart(tok: Token): boolean {
    return tok.type === TokenType.KEYWORD && TYPE_KEYWORDS.has(tok.value)
  }

  private skipLine() {
    // consume until next type-start or keyword that starts a block-level item
    let depth = 0
    while (!this.check(TokenType.EOF)) {
      const t = this.peek()
      if (t.type === TokenType.LBRACE) depth++
      if (t.type === TokenType.RBRACE) {
        if (depth === 0) break
        depth--
      }
      this.next()
      if (depth === 0 && (t.type === TokenType.RBRACE || (t.type === TokenType.KEYWORD && ['call','if','scatter','task','workflow','output','input','runtime','command'].includes(t.value)))) break
    }
  }

  private skipToMatchingBrace() {
    let depth = 0
    while (!this.check(TokenType.EOF)) {
      const t = this.next()
      if (t.type === TokenType.LBRACE) depth++
      if (t.type === TokenType.RBRACE) { depth--; if (depth <= 0) break }
    }
  }

  private recoverToTopLevel() {
    while (!this.check(TokenType.EOF)) {
      const t = this.peek()
      if (t.type === TokenType.KEYWORD && (t.value === 'task' || t.value === 'workflow' || t.value === 'import' || t.value === 'struct')) break
      this.next()
    }
  }

  private exprToString(expr: WdlExpr): string {
    if (expr.kind === 'string_literal') return expr.value
    if (expr.kind === 'number_literal') return String(expr.value)
    if (expr.kind === 'identifier') return expr.name
    if (expr.kind === 'bool_literal') return String(expr.value)
    return ''
  }

  private readHeredocManual(): string {
    // skip <<< tokens if tokenizer yielded them as LT LT LT
    while (this.check(TokenType.LT)) this.next()
    let content = ''
    while (!this.check(TokenType.EOF)) {
      const t = this.peek()
      if (t.type === TokenType.GT) {
        this.next()
        if (this.check(TokenType.GT)) {
          this.next()
          if (this.check(TokenType.GT)) { this.next(); break }
        }
      }
      content += t.value + ' '
      this.next()
    }
    return content
  }
}
