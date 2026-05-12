import type { WdlGraph, WdlNode } from './graph-model'

const H_GAP = 80
const V_GAP = 40

export function layoutGraph(graph: WdlGraph): WdlGraph {
  if (graph.nodes.length === 0) return graph
  return layoutFallback(graph)
}

function layoutFallback(graph: WdlGraph): WdlGraph {
  // Exclude group nodes — they are visual overlays sized from children
  const nodes = graph.nodes.filter(n => n.kind !== 'if_group' && n.kind !== 'scatter_group')
  const edges = graph.edges

  const inEdges = new Map<string, string[]>()
  const outEdges = new Map<string, string[]>()
  for (const n of nodes) { inEdges.set(n.id, []); outEdges.set(n.id, []) }
  for (const e of edges) {
    inEdges.get(e.targetNodeId)?.push(e.sourceNodeId)
    outEdges.get(e.sourceNodeId)?.push(e.targetNodeId)
  }

  // Assign ranks via iterative Bellman-Ford style longest path
  const rank = new Map<string, number>()
  for (const n of nodes) rank.set(n.id, 0)

  // Multiple relaxation passes
  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false
    for (const e of edges) {
      const srcRank = rank.get(e.sourceNodeId)
      const tgtRank = rank.get(e.targetNodeId)
      if (srcRank !== undefined && tgtRank !== undefined && tgtRank <= srcRank) {
        rank.set(e.targetNodeId, srcRank + 1)
        changed = true
      }
    }
    if (!changed) break
  }

  const byRank = new Map<number, WdlNode[]>()
  for (const n of nodes) {
    const r = rank.get(n.id) ?? 0
    if (!byRank.has(r)) byRank.set(r, [])
    byRank.get(r)!.push(n)
  }

  const sortedRanks = [...byRank.keys()].sort((a, b) => a - b)

  const colX: number[] = []
  let x = 40
  for (const r of sortedRanks) {
    colX[r] = x
    const colWidth = Math.max(...byRank.get(r)!.map(n => n.width))
    x += colWidth + H_GAP
  }

  const positioned = new Map<string, { x: number; y: number }>()

  for (const r of sortedRanks) {
    const col = byRank.get(r)!
    let y = 40
    for (const n of col) {
      positioned.set(n.id, { x: colX[r], y })
      y += n.height + V_GAP
    }
  }

  return {
    ...graph,
    nodes: graph.nodes.map(n => ({
      ...n,
      x: positioned.get(n.id)?.x ?? n.x,
      y: positioned.get(n.id)?.y ?? n.y
    }))
  }
}

export function dagreLayout(graph: WdlGraph, rankdir: 'LR' | 'TB' | 'RL' | 'BT' = 'LR'): Promise<WdlGraph> {
  return import('@dagrejs/dagre').then(({ default: dagre }) => {
    // Only layout call/io nodes — group nodes are visual overlays computed post-layout
    const callNodes = graph.nodes.filter(
      n => n.kind !== 'if_group' && n.kind !== 'scatter_group'
    )
    const nodeCount = callNodes.length

    // Adaptive spacing: large graphs need tighter packing
    const ranksep = nodeCount > 30 ? 50 : 80
    const nodesep = nodeCount > 30 ? 25 : 40

    const g = new dagre.graphlib.Graph()
    g.setGraph({ rankdir, ranksep, nodesep, edgesep: 10, marginx: 40, marginy: 40 })
    g.setDefaultEdgeLabel(() => ({}))

    const callNodeIdSet = new Set(callNodes.map(n => n.id))
    for (const node of callNodes) {
      g.setNode(node.id, { width: node.width, height: node.height, label: node.label })
    }
    for (const edge of graph.edges) {
      if (callNodeIdSet.has(edge.sourceNodeId) && callNodeIdSet.has(edge.targetNodeId)) {
        g.setEdge(edge.sourceNodeId, edge.targetNodeId)
      }
    }

    dagre.layout(g)

    // Collect dagre positions for call nodes
    const posMap = new Map<string, { x: number; y: number }>()
    for (const node of callNodes) {
      const dn = g.node(node.id)
      if (dn) posMap.set(node.id, { x: dn.x - node.width / 2, y: dn.y - node.height / 2 })
    }

    // Compute group bounding boxes from their children
    const GROUP_PADDING = 20
    const groupBboxes = new Map<string, { minX: number; minY: number; maxX: number; maxY: number }>()

    // Pass 1: seed bboxes from call-node children
    for (const node of graph.nodes) {
      if (!node.containedIn) continue
      const pos = posMap.get(node.id)
      if (!pos) continue
      const cur = groupBboxes.get(node.containedIn)
      const r = pos.x + node.width, b = pos.y + node.height
      groupBboxes.set(node.containedIn, cur ? {
        minX: Math.min(cur.minX, pos.x), minY: Math.min(cur.minY, pos.y),
        maxX: Math.max(cur.maxX, r), maxY: Math.max(cur.maxY, b)
      } : { minX: pos.x, minY: pos.y, maxX: r, maxY: b })
    }

    // Pass 2: propagate child-group bboxes upward (up to 4 nesting levels)
    for (let pass = 0; pass < 4; pass++) {
      for (const node of graph.nodes) {
        if ((node.kind !== 'if_group' && node.kind !== 'scatter_group') || !node.containedIn) continue
        const child = groupBboxes.get(node.id)
        if (!child) continue
        const cur = groupBboxes.get(node.containedIn)
        const minX = child.minX - GROUP_PADDING, minY = child.minY - GROUP_PADDING
        const maxX = child.maxX + GROUP_PADDING, maxY = child.maxY + GROUP_PADDING
        groupBboxes.set(node.containedIn, cur ? {
          minX: Math.min(cur.minX, minX), minY: Math.min(cur.minY, minY),
          maxX: Math.max(cur.maxX, maxX), maxY: Math.max(cur.maxY, maxY)
        } : { minX, minY, maxX, maxY })
      }
    }

    return {
      ...graph,
      nodes: graph.nodes.map(n => {
        if (n.kind === 'if_group' || n.kind === 'scatter_group') {
          const bbox = groupBboxes.get(n.id)
          if (bbox && isFinite(bbox.minX)) {
            return {
              ...n,
              x: bbox.minX - GROUP_PADDING,
              y: bbox.minY - GROUP_PADDING,
              width: bbox.maxX - bbox.minX + GROUP_PADDING * 2,
              height: bbox.maxY - bbox.minY + GROUP_PADDING * 2
            }
          }
          return n
        }
        const pos = posMap.get(n.id)
        return pos ? { ...n, x: pos.x, y: pos.y } : n
      })
    }
  })
}
