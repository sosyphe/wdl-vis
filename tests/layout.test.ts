import { describe, it, expect } from 'vitest'
import { parseWdl } from '../src/parser/parser'
import { buildGraph } from '../src/graph/graph-builder'
import { layoutGraph, dagreLayout } from '../src/graph/layout'

const SIMPLE_WDL = `
  version 1.0
  workflow W {
    input { String name }
    call greet { input: x = name }
    output { String result = greet.msg }
  }
  task greet {
    input { String x }
    command { echo ~{x} }
    output { String msg = read_string(stdout()) }
  }
`

describe('layoutGraph', () => {
  it('assigns x/y coordinates to all nodes', () => {
    const graph = buildGraph(parseWdl(SIMPLE_WDL))
    const laid = layoutGraph(graph)
    for (const node of laid.nodes) {
      expect(typeof node.x).toBe('number')
      expect(typeof node.y).toBe('number')
    }
  })

  it('returns a new graph object without mutating the original', () => {
    const graph = buildGraph(parseWdl(SIMPLE_WDL))
    const originalPositions = graph.nodes.map(n => ({ x: n.x, y: n.y }))
    layoutGraph(graph)
    graph.nodes.forEach((n, i) => {
      expect(n.x).toBe(originalPositions[i].x)
      expect(n.y).toBe(originalPositions[i].y)
    })
  })

  it('handles a single-node graph without error', () => {
    const graph = buildGraph(parseWdl(`version 1.0\nworkflow Empty {}`))
    const laid = layoutGraph(graph)
    expect(laid.nodes).toHaveLength(graph.nodes.length)
  })
})

describe('dagreLayout', () => {
  it('assigns x/y coordinates to all nodes', async () => {
    const graph = buildGraph(parseWdl(SIMPLE_WDL))
    const laid = await dagreLayout(graph, 'LR')
    for (const node of laid.nodes) {
      expect(typeof node.x).toBe('number')
      expect(typeof node.y).toBe('number')
    }
  })

  it('supports all four layout directions', async () => {
    const graph = buildGraph(parseWdl(SIMPLE_WDL))
    for (const dir of ['LR', 'TB', 'RL', 'BT'] as const) {
      const laid = await dagreLayout(graph, dir)
      expect(laid.nodes.length).toBeGreaterThan(0)
    }
  })

  it('LR layout has nodes spread horizontally', async () => {
    const graph = buildGraph(parseWdl(SIMPLE_WDL))
    const laid = await dagreLayout(graph, 'LR')
    const callNodes = laid.nodes.filter(n => n.kind !== 'if_group' && n.kind !== 'scatter_group')
    const xs = callNodes.map(n => n.x)
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0)
  })

  it('TB layout has nodes spread vertically', async () => {
    const graph = buildGraph(parseWdl(SIMPLE_WDL))
    const laid = await dagreLayout(graph, 'TB')
    const callNodes = laid.nodes.filter(n => n.kind !== 'if_group' && n.kind !== 'scatter_group')
    const ys = callNodes.map(n => n.y)
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0)
  })
})
