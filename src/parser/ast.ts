export interface WdlDocument {
  workflow: WdlWorkflow | null
  tasks: WdlTask[]
  errors: string[]
}

export interface WdlWorkflow {
  name: string
  declarations: WdlDeclaration[]
  body: WdlStatement[]
  outputs: WdlOutputDeclaration[]
}

export interface WdlTask {
  name: string
  inputs: WdlDeclaration[]
  command: string
  commandStyle: 'brace' | 'heredoc'
  outputs: WdlOutputDeclaration[]
  runtime: Record<string, string>
  meta: Record<string, string>
}

export interface WdlDeclaration {
  type: WdlType
  name: string
  defaultValue: WdlExpr | null
}

export interface WdlOutputDeclaration {
  type: WdlType
  name: string
  value: WdlExpr
}

export type WdlStatement = WdlCallStatement | WdlIfBlock | WdlScatterBlock

export interface WdlCallStatement {
  kind: 'call'
  task: string
  alias: string | null
  effectiveName: string
  inputs: WdlCallInput[]
}

export interface WdlCallInput {
  param: string
  value: WdlExpr
}

export interface WdlIfBlock {
  kind: 'if'
  condition: WdlExpr
  body: WdlStatement[]
}

export interface WdlScatterBlock {
  kind: 'scatter'
  variable: string
  collection: WdlExpr
  body: WdlStatement[]
}

export type WdlType =
  | { base: 'String' | 'Int' | 'Float' | 'File' | 'Boolean' | 'Object'; optional: boolean }
  | { base: 'Array'; itemType: WdlType; optional: boolean }
  | { base: 'Map'; keyType: WdlType; valueType: WdlType; optional: boolean }
  | { base: 'Pair'; leftType: WdlType; rightType: WdlType; optional: boolean }
  | { base: 'Unknown'; optional: boolean }

export type WdlExpr =
  | { kind: 'identifier'; name: string }
  | { kind: 'output_ref'; call: string; output: string }
  | { kind: 'string_literal'; value: string }
  | { kind: 'number_literal'; value: number }
  | { kind: 'bool_literal'; value: boolean }
  | { kind: 'null_literal' }
  | { kind: 'index'; array: WdlExpr; index: WdlExpr }
  | { kind: 'call_expr'; fn: string; args: WdlExpr[] }
  | { kind: 'array_literal'; elements: WdlExpr[] }
  | { kind: 'map_literal'; entries: { key: WdlExpr; value: WdlExpr }[] }
  | { kind: 'ternary'; condition: WdlExpr; then: WdlExpr; else: WdlExpr }
  | { kind: 'not'; operand: WdlExpr }
  | { kind: 'binary'; op: string; left: WdlExpr; right: WdlExpr }
  | { kind: 'unknown'; raw: string }
