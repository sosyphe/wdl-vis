import { describe, it, expect } from 'vitest'
import { parseWdl } from '../src/parser/parser'
import { buildGraph } from '../src/graph/graph-builder'

describe('buildGraph', () => {
  it('creates workflow_input and workflow_output nodes', () => {
    const doc = parseWdl(`
      version 1.0
      workflow W {
        input { String name }
        output { String result = name }
      }
    `)
    const graph = buildGraph(doc)
    expect(graph.errors).toHaveLength(0)
    expect(graph.nodes.some(n => n.kind === 'workflow_input')).toBe(true)
    expect(graph.nodes.some(n => n.kind === 'workflow_output')).toBe(true)
  })

  it('creates a call node for each task call', () => {
    const doc = parseWdl(`
      version 1.0
      workflow W {
        call taskA {}
        call taskB {}
      }
      task taskA { command { echo a } output {} }
      task taskB { command { echo b } output {} }
    `)
    const graph = buildGraph(doc)
    const callNodes = graph.nodes.filter(n => n.kind === 'call')
    expect(callNodes).toHaveLength(2)
    expect(callNodes.map(n => n.label)).toContain('taskA')
    expect(callNodes.map(n => n.label)).toContain('taskB')
  })

  it('creates an edge for output_ref dependency', () => {
    const doc = parseWdl(`
      version 1.0
      workflow W {
        call step1 {}
        call step2 { input: x = step1.result }
      }
      task step1 { command { echo hi } output { String result = read_string(stdout()) } }
      task step2 { input { String x } command { echo ~{x} } output {} }
    `)
    const graph = buildGraph(doc)
    expect(graph.edges.length).toBeGreaterThan(0)
    const edge = graph.edges.find(e =>
      graph.nodes.find(n => n.id === e.sourceNodeId)?.label === 'step1' &&
      graph.nodes.find(n => n.id === e.targetNodeId)?.label === 'step2'
    )
    expect(edge).toBeDefined()
  })

  it('creates a scatter_group node for scatter blocks', () => {
    const doc = parseWdl(`
      version 1.0
      workflow W {
        input { Array[String] items }
        scatter (item in items) {
          call process { input: x = item }
        }
      }
      task process { input { String x } command { echo ~{x} } output {} }
    `)
    const graph = buildGraph(doc)
    expect(graph.nodes.some(n => n.kind === 'scatter_group')).toBe(true)
  })

  it('creates an if_group node for if blocks', () => {
    const doc = parseWdl(`
      version 1.0
      workflow W {
        input { Boolean flag }
        if (flag) {
          call optTask {}
        }
      }
      task optTask { command { echo hi } output {} }
    `)
    const graph = buildGraph(doc)
    expect(graph.nodes.some(n => n.kind === 'if_group')).toBe(true)
  })

  it('sets workflowName from the parsed workflow', () => {
    const doc = parseWdl(`
      version 1.0
      workflow MyFlow {
        call t {}
      }
      task t { command { echo hi } output {} }
    `)
    const graph = buildGraph(doc)
    expect(graph.workflowName).toBe('MyFlow')
  })

  it('attaches runtimeInfo and command to call nodes', () => {
    const doc = parseWdl(`
      version 1.0
      workflow W {
        call greet {}
      }
      task greet {
        command { echo hello }
        output {}
        runtime { docker: "ubuntu:20.04" cpu: "2" }
      }
    `)
    const graph = buildGraph(doc)
    const node = graph.nodes.find(n => n.kind === 'call')
    expect(node?.runtimeInfo?.['docker']).toBe('ubuntu:20.04')
    expect(node?.command).toBeTruthy()
  })

  it('returns empty graph for input with no workflow', () => {
    const doc = parseWdl(`not valid wdl`)
    const graph = buildGraph(doc)
    expect(graph.nodes).toHaveLength(0)
    expect(graph.edges).toHaveLength(0)
  })

  it('handles empty workflow with no calls', () => {
    const doc = parseWdl(`
      version 1.0
      workflow Empty {}
    `)
    const graph = buildGraph(doc)
    expect(graph.errors).toHaveLength(0)
    expect(graph.nodes.filter(n => n.kind === 'call')).toHaveLength(0)
  })
})
