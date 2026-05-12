export interface PortDef {
  name: string
  type: string
  nodeId: string
  defaultValue?: string
}

export type NodeKind = 'workflow_input' | 'workflow_output' | 'call' | 'if_group' | 'scatter_group'

export interface WdlNode {
  id: string
  kind: NodeKind
  label: string
  taskName: string | null
  inputs: PortDef[]
  outputs: PortDef[]
  containedIn: string | null
  x: number
  y: number
  width: number
  height: number      // layout height: capped at MAX_VISIBLE_PORTS rows
  fullHeight: number  // expanded height: all port rows
  runtimeInfo?: Record<string, string>
  command?: string
  conditionalDepth: number
}

export interface WdlEdge {
  id: string
  sourceNodeId: string
  sourcePort: string
  targetNodeId: string
  targetPort: string
  conditional: boolean
  label?: string
}

export interface WdlGraph {
  nodes: WdlNode[]
  edges: WdlEdge[]
  workflowName: string
  errors: string[]
}
