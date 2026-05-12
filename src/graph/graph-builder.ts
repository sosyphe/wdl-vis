import type { WdlDocument, WdlTask, WdlType, WdlExpr, WdlStatement, WdlCallStatement, WdlIfBlock, WdlScatterBlock } from '../parser/ast'
import type { WdlGraph, WdlNode, WdlEdge, PortDef } from './graph-model'

interface FlatCall {
  stmt: WdlCallStatement
  containedIn: string | null
  conditionalDepth: number
}

interface FlatGroup {
  id: string
  kind: 'if_group' | 'scatter_group'
  label: string
  containedIn: string | null
  conditionalDepth: number
}

type SymbolRef = { nodeId: string; portName: string }

export function buildGraph(doc: WdlDocument): WdlGraph {
  if (!doc.workflow) {
    return { nodes: [], edges: [], workflowName: '', errors: doc.errors }
  }

  const taskMap = new Map<string, WdlTask>()
  for (const t of doc.tasks) taskMap.set(t.name, t)

  // Flatten all statements into calls and groups
  const flatCalls: FlatCall[] = []
  const flatGroups: FlatGroup[] = []
  let groupCounter = 0

  function flattenStmts(stmts: WdlStatement[], parentId: string | null, depth: number) {
    for (const stmt of stmts) {
      if (stmt.kind === 'call') {
        flatCalls.push({ stmt, containedIn: parentId, conditionalDepth: depth })
      } else if (stmt.kind === 'if') {
        const id = `__if_${groupCounter++}`
        flatGroups.push({ id, kind: 'if_group', label: 'if (...)', containedIn: parentId, conditionalDepth: depth })
        flattenStmts(stmt.body, id, depth + 1)
      } else if (stmt.kind === 'scatter') {
        const id = `__scatter_${groupCounter++}`
        const s = stmt as WdlScatterBlock
        flatGroups.push({ id, kind: 'scatter_group', label: `scatter (${s.variable})`, containedIn: parentId, conditionalDepth: depth })
        flattenStmts(stmt.body, id, depth + 1)
      }
    }
  }

  flattenStmts(doc.workflow.body, null, 0)

  const HEADER_H_GB = 32
  const PORT_SPACING_GB = 18
  const MAX_VISIBLE_PORTS = 5

  // Create workflow_input node
  const wfInPorts = doc.workflow.declarations.map(d => ({
    name: d.name, type: typeToString(d.type), nodeId: '__wf_inputs'
  }))
  const wfInPortMaxLen = Math.max(0, ...wfInPorts.map(p => p.name.length))
  const wfInWidth = Math.max(160, wfInPortMaxLen * 7 + 24)
  const wfInPortCount = wfInPorts.length
  const wfInFullHeight = Math.max(50, HEADER_H_GB + wfInPortCount * PORT_SPACING_GB + 12)
  const wfInHeight = Math.max(50, HEADER_H_GB + Math.min(wfInPortCount, MAX_VISIBLE_PORTS) * PORT_SPACING_GB + 12)
  const wfInputNode: WdlNode = {
    id: '__wf_inputs',
    kind: 'workflow_input',
    label: 'Workflow Inputs',
    taskName: null,
    inputs: [],
    outputs: wfInPorts,
    containedIn: null,
    x: 0, y: 0,
    width: wfInWidth, height: wfInHeight, fullHeight: wfInFullHeight,
    conditionalDepth: 0
  }

  // Create workflow_output node
  const wfOutPorts = doc.workflow.outputs.map(d => ({
    name: d.name, type: typeToString(d.type), nodeId: '__wf_outputs'
  }))
  const wfOutPortMaxLen = Math.max(0, ...wfOutPorts.map(p => p.name.length))
  const wfOutWidth = Math.max(160, wfOutPortMaxLen * 7 + 24)
  const wfOutPortCount = wfOutPorts.length
  const wfOutFullHeight = Math.max(50, HEADER_H_GB + wfOutPortCount * PORT_SPACING_GB + 12)
  const wfOutHeight = Math.max(50, HEADER_H_GB + Math.min(wfOutPortCount, MAX_VISIBLE_PORTS) * PORT_SPACING_GB + 12)
  const wfOutputNode: WdlNode = {
    id: '__wf_outputs',
    kind: 'workflow_output',
    label: 'Workflow Outputs',
    taskName: null,
    inputs: wfOutPorts,
    outputs: [],
    containedIn: null,
    x: 0, y: 0,
    width: wfOutWidth, height: wfOutHeight, fullHeight: wfOutFullHeight,
    conditionalDepth: 0
  }

  // Create group nodes
  const groupNodes: WdlNode[] = flatGroups.map(g => ({
    id: g.id,
    kind: g.kind,
    label: g.label,
    taskName: null,
    inputs: [],
    outputs: [],
    containedIn: g.containedIn,
    x: 0, y: 0, width: 160, height: 60, fullHeight: 60,
    conditionalDepth: g.conditionalDepth
  }))

  // Create call nodes
  const callNodes: WdlNode[] = flatCalls.map(fc => {
    const task = taskMap.get(fc.stmt.task)
    const inputs: PortDef[] = task
      ? task.inputs.map(i => ({
          name: i.name,
          type: typeToString(i.type),
          nodeId: fc.stmt.effectiveName,
          defaultValue: i.defaultValue ? exprToString(i.defaultValue) : undefined
        }))
      : fc.stmt.inputs.map(i => ({ name: i.param, type: 'unknown', nodeId: fc.stmt.effectiveName }))
    const outputs: PortDef[] = task
      ? task.outputs.map(o => ({
          name: o.name,
          type: typeToString(o.type),
          nodeId: fc.stmt.effectiveName,
          defaultValue: exprToString(o.value)
        }))
      : []

    const label = fc.stmt.effectiveName
    const sublabel = fc.stmt.alias ? fc.stmt.task : ''
    const maxLen = Math.max(label.length, sublabel.length)
    const portMaxLen = Math.max(0, ...inputs.map(i => i.name.length), ...outputs.map(o => o.name.length))
    const width = Math.max(180, maxLen * 8 + 24, portMaxLen * 7 + 24)
    const portCount = Math.max(inputs.length, outputs.length)
    const fullHeight = Math.max(60, HEADER_H_GB + portCount * PORT_SPACING_GB + 12)
    const height = Math.max(60, HEADER_H_GB + Math.min(portCount, MAX_VISIBLE_PORTS) * PORT_SPACING_GB + 12)

    return {
      id: fc.stmt.effectiveName,
      kind: 'call' as const,
      label,
      taskName: fc.stmt.task,
      inputs,
      outputs,
      containedIn: fc.containedIn,
      x: 0, y: 0, width, height, fullHeight,
      runtimeInfo: task?.runtime,
      command: task?.command,
      conditionalDepth: fc.conditionalDepth
    }
  })

  const allNodes: WdlNode[] = doc.workflow.outputs.length > 0
    ? [wfInputNode, ...groupNodes, ...callNodes, wfOutputNode]
    : [wfInputNode, ...groupNodes, ...callNodes]
  const nodeMap = new Map<string, WdlNode>(allNodes.map(n => [n.id, n]))

  // Build symbol table: symbolTable[nodeId][portName] = SymbolRef
  const symbolTable = new Map<string, Map<string, SymbolRef>>()

  function registerOutputs(node: WdlNode) {
    const portMap = new Map<string, SymbolRef>()
    for (const p of node.outputs) {
      portMap.set(p.name, { nodeId: node.id, portName: p.name })
    }
    symbolTable.set(node.id, portMap)
  }

  registerOutputs(wfInputNode)
  for (const n of callNodes) registerOutputs(n)

  // Also register workflow-level declarations by name in __wf scope
  const wfScope = new Map<string, SymbolRef>()
  for (const d of doc.workflow.declarations) {
    wfScope.set(d.name, { nodeId: '__wf_inputs', portName: d.name })
  }
  symbolTable.set('__wf', wfScope)

  // Build edges
  const edges: WdlEdge[] = []
  const edgeSet = new Set<string>()

  function addEdge(src: SymbolRef, targetNodeId: string, targetPort: string, conditional: boolean) {
    const id = `${src.nodeId}:${src.portName}->${targetNodeId}:${targetPort}`
    if (edgeSet.has(id)) return
    edgeSet.add(id)
    edges.push({ id, sourceNodeId: src.nodeId, sourcePort: src.portName, targetNodeId, targetPort, conditional })
  }

  function resolveExpr(expr: WdlExpr, targetNodeId: string, targetPort: string, conditional: boolean) {
    if (expr.kind === 'output_ref') {
      const callPorts = symbolTable.get(expr.call)
      if (callPorts) {
        const ref = callPorts.get(expr.output)
        if (ref) addEdge(ref, targetNodeId, targetPort, conditional)
      }
    } else if (expr.kind === 'identifier') {
      // Check workflow-level scope
      const ref = wfScope.get(expr.name)
      if (ref) addEdge(ref, targetNodeId, targetPort, conditional)
    } else if (expr.kind === 'call_expr') {
      for (const arg of expr.args) resolveExpr(arg, targetNodeId, targetPort, conditional)
    } else if (expr.kind === 'array_literal') {
      for (const el of expr.elements) resolveExpr(el, targetNodeId, targetPort, conditional)
    } else if (expr.kind === 'ternary') {
      resolveExpr(expr.then, targetNodeId, targetPort, conditional)
      resolveExpr(expr.else, targetNodeId, targetPort, conditional)
    } else if (expr.kind === 'binary') {
      resolveExpr(expr.left, targetNodeId, targetPort, conditional)
      resolveExpr(expr.right, targetNodeId, targetPort, conditional)
    } else if (expr.kind === 'index') {
      resolveExpr(expr.array, targetNodeId, targetPort, conditional)
    }
  }

  // Resolve call inputs to edges
  for (const fc of flatCalls) {
    const isConditional = fc.conditionalDepth > 0
    for (const inp of fc.stmt.inputs) {
      resolveExpr(inp.value, fc.stmt.effectiveName, inp.param, isConditional)
    }
  }

  // Resolve workflow outputs
  for (const out of doc.workflow.outputs) {
    resolveExpr(out.value, '__wf_outputs', out.name, false)
  }

  return {
    nodes: allNodes,
    edges,
    workflowName: doc.workflow.name,
    errors: doc.errors
  }
}

function typeToString(t: WdlType): string {
  if (t.base === 'Array') return `Array[${typeToString(t.itemType)}]${t.optional ? '?' : ''}`
  if (t.base === 'Map') return `Map[${typeToString(t.keyType)},${typeToString(t.valueType)}]${t.optional ? '?' : ''}`
  if (t.base === 'Pair') return `Pair[${typeToString(t.leftType)},${typeToString(t.rightType)}]${t.optional ? '?' : ''}`
  return t.base + (t.optional ? '?' : '')
}

function exprToString(expr: WdlExpr): string {
  switch (expr.kind) {
    case 'identifier': return expr.name
    case 'output_ref': return `${expr.call}.${expr.output}`
    case 'string_literal': return `"${expr.value}"`
    case 'number_literal': return String(expr.value)
    case 'bool_literal': return String(expr.value)
    case 'null_literal': return 'null'
    case 'array_literal': return `[${expr.elements.map(exprToString).join(', ')}]`
    case 'map_literal': return `{${expr.entries.map(e => `${exprToString(e.key)}: ${exprToString(e.value)}`).join(', ')}}`
    case 'index': return `${exprToString(expr.array)}[${exprToString(expr.index)}]`
    case 'call_expr': return `${expr.fn}(${expr.args.map(exprToString).join(', ')})`
    case 'ternary': return `if ${exprToString(expr.condition)} then ${exprToString(expr.then)} else ${exprToString(expr.else)}`
    case 'not': return `!${exprToString(expr.operand)}`
    case 'binary': return `${exprToString(expr.left)} ${expr.op} ${exprToString(expr.right)}`
    case 'unknown': return expr.raw
  }
}
