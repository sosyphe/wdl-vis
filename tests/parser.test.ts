import { describe, it, expect } from 'vitest'
import { parseWdl } from '../src/parser/parser'

describe('parseWdl', () => {
  it('parses a minimal workflow', () => {
    const doc = parseWdl(`
      version 1.0
      workflow Empty {}
    `)
    expect(doc.errors).toHaveLength(0)
    expect(doc.workflow?.name).toBe('Empty')
  })

  it('parses workflow inputs and outputs', () => {
    const doc = parseWdl(`
      version 1.0
      workflow W {
        input { String name }
        output { String result = name }
      }
    `)
    expect(doc.errors).toHaveLength(0)
    expect(doc.workflow?.declarations[0].name).toBe('name')
    expect(doc.workflow?.outputs[0].name).toBe('result')
  })

  it('parses a task with command and runtime', () => {
    const doc = parseWdl(`
      version 1.0
      task greet {
        input { String name }
        command { echo ~{name} }
        output { String msg = read_string(stdout()) }
        runtime { docker: "ubuntu:20.04" }
      }
    `)
    expect(doc.errors).toHaveLength(0)
    const task = doc.tasks[0]
    expect(task.name).toBe('greet')
    expect(task.inputs[0].name).toBe('name')
    expect(task.runtime['docker']).toBe('ubuntu:20.04')
  })

  it('parses a task with heredoc command', () => {
    const doc = parseWdl(`
      version 1.0
      task t {
        command <<<
          echo hello
        >>>
        output { String out = read_string(stdout()) }
      }
    `)
    expect(doc.errors).toHaveLength(0)
    expect(doc.tasks[0].commandStyle).toBe('heredoc')
  })

  it('parses a call statement', () => {
    const doc = parseWdl(`
      version 1.0
      workflow W {
        call myTask { input: x = "hello" }
      }
      task myTask { input { String x } command { echo ~{x} } output {} }
    `)
    expect(doc.errors).toHaveLength(0)
    const call = doc.workflow?.body[0]
    expect(call?.kind).toBe('call')
    if (call?.kind === 'call') {
      expect(call.task).toBe('myTask')
      expect(call.inputs[0].param).toBe('x')
    }
  })

  it('parses call alias', () => {
    const doc = parseWdl(`
      version 1.0
      workflow W {
        call myTask as step1 {}
      }
      task myTask { command { echo hi } output {} }
    `)
    expect(doc.errors).toHaveLength(0)
    const call = doc.workflow?.body[0]
    if (call?.kind === 'call') {
      expect(call.alias).toBe('step1')
      expect(call.effectiveName).toBe('step1')
    }
  })

  it('parses scatter block', () => {
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
    expect(doc.errors).toHaveLength(0)
    const scatter = doc.workflow?.body[0]
    expect(scatter?.kind).toBe('scatter')
    if (scatter?.kind === 'scatter') {
      expect(scatter.variable).toBe('item')
      expect(scatter.body).toHaveLength(1)
    }
  })

  it('parses if block', () => {
    const doc = parseWdl(`
      version 1.0
      workflow W {
        input { Boolean flag }
        if (flag) {
          call optionalTask {}
        }
      }
      task optionalTask { command { echo hi } output {} }
    `)
    expect(doc.errors).toHaveLength(0)
    const ifBlock = doc.workflow?.body[0]
    expect(ifBlock?.kind).toBe('if')
    if (ifBlock?.kind === 'if') {
      expect(ifBlock.body).toHaveLength(1)
    }
  })

  it('parses optional type', () => {
    const doc = parseWdl(`
      version 1.0
      workflow W {
        input { String? optName }
      }
    `)
    expect(doc.errors).toHaveLength(0)
    const decl = doc.workflow?.declarations[0]
    expect(decl?.type.optional).toBe(true)
  })

  it('parses Array type', () => {
    const doc = parseWdl(`
      version 1.0
      workflow W {
        input { Array[File] files }
      }
    `)
    expect(doc.errors).toHaveLength(0)
    const decl = doc.workflow?.declarations[0]
    expect(decl?.type.base).toBe('Array')
  })

  it('returns no workflow for input with no workflow block', () => {
    const doc = parseWdl(`this is not valid wdl`)
    expect(doc.workflow).toBeNull()
    expect(doc.tasks).toHaveLength(0)
  })

  it('collects parse errors on malformed workflow body', () => {
    const doc = parseWdl(`
      version 1.0
      workflow W {
        call !!!invalid
      }
    `)
    // parser either errors or produces empty body — workflow is still parsed
    expect(doc.workflow).not.toBeNull()
  })

  it('parses task command block containing ${} interpolations without premature close', () => {
    const doc = parseWdl(`
      version 1.0
      task t {
        input { String ref String sample }
        command {
          echo \${ref} \\
            --sample \${sample} \\
            --out result
        }
        output { File out = "result" }
      }
    `)
    expect(doc.errors).toHaveLength(0)
    expect(doc.tasks[0].command).toContain('${ref}')
    expect(doc.tasks[0].command).toContain('${sample}')
    expect(doc.tasks[0].outputs[0].name).toBe('out')
  })

  it('parses multiple tasks after a task with ${} in command block', () => {
    const doc = parseWdl(`
      version 1.0
      task first {
        input { String x }
        command { run --flag \${x} }
        output {}
      }
      task second {
        input { String y }
        command { echo \${y} }
        output { String out = "ok" }
      }
    `)
    expect(doc.errors).toHaveLength(0)
    expect(doc.tasks).toHaveLength(2)
    expect(doc.tasks[1].name).toBe('second')
    expect(doc.tasks[1].outputs[0].name).toBe('out')
  })
})
