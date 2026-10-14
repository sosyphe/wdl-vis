// Vue-free entry point (`wdl-viewer/parser`).
//
// Everything here is pure logic: no Vue, no DOM, no bundler-specific syntax.
// Editor integrations, CLI tools and tests can depend on this subpath without
// dragging the Vue runtime into a Node process.
//
// Deliberately NOT exported: `Tokenizer`/`TokenType` — `TokenType` is a
// `const enum`, which is inlined at compile time and cannot be consumed safely
// by external bundlers running under `isolatedModules`.

export { parseWdl } from './parser'
export { ParseError } from './errors'

export type {
  WdlDocument,
  WdlTask,
  WdlWorkflow,
  WdlStatement,
  WdlCallStatement,
  WdlCallInput,
  WdlIfBlock,
  WdlScatterBlock,
  WdlDeclaration,
  WdlOutputDeclaration,
  WdlType,
  WdlExpr,
} from './ast'

export { KEYWORDS, TYPE_KEYWORDS } from './tokenizer'

// Type-only re-exports: erased at build time, so no graph/layout runtime code
// (and no dagre) is pulled into this entry. Editor integrations need them to
// type-check payloads originating from `WdlViewer`'s node/edge events.
export type { WdlGraph, WdlNode, WdlEdge, PortDef, NodeKind } from '../graph/graph-model'

export {
  findTaskBlock,
  findCallBlock,
  findWorkflowBlock,
  findBlockWithin,
} from './locate'
export type { BlockRange } from './locate'
