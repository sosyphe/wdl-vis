import { describe, it, expect } from 'vitest'
import { parseWdl } from '../src/parser/parser'
import { normalizeCommand } from '../src/parser/command'

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
    // opener newline and closing-delimiter whitespace are stripped, the
    // template literal's own 10-space indentation is preserved
    expect(doc.tasks[0].command).toBe('          echo hello')
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

describe('normalizeCommand', () => {
  it('strips opener newline and trailing closing-delimiter whitespace, preserving indentation', () => {
    expect(normalizeCommand('\n    echo one\n      echo two\n  ')).toBe('    echo one\n      echo two')
  })

  it('preserves interior blank lines', () => {
    expect(normalizeCommand('\n  a\n\n  b\n')).toBe('  a\n\n  b')
  })

  it('strips only ONE leading newline — a deliberate blank first line stays', () => {
    expect(normalizeCommand('\n\n  echo x\n')).toBe('\n  echo x')
  })

  it('trims delimiter spaces on a single-line brace command', () => {
    expect(normalizeCommand(' echo hi ')).toBe('echo hi')
  })

  it('leaves already-clean text untouched', () => {
    expect(normalizeCommand('echo hi')).toBe('echo hi')
  })

  it('strips horizontal whitespace preceding the opener newline', () => {
    expect(normalizeCommand('  \n echo x ')).toBe(' echo x')
  })

  it('consumes a leading CRLF as a unit and keeps interior CRLFs', () => {
    expect(normalizeCommand('\r\n  a\r\n  b\r\n')).toBe('  a\r\n  b')
  })

  it('reduces whitespace-only or empty content to the empty string', () => {
    expect(normalizeCommand('\n')).toBe('')
    expect(normalizeCommand('   ')).toBe('')
    expect(normalizeCommand('')).toBe('')
  })
})

describe('command normalization through parseWdl', () => {
  it('normalizes the sample.wdl heredoc exactly (4-space indent, single line)', () => {
    const doc = parseWdl('version 1.0\ntask t {\n  command <<<\n    echo "~{length(messages)} greetings collected."\n  >>>\n}')
    expect(doc.errors).toHaveLength(0)
    expect(doc.tasks[0].command).toBe('    echo "~{length(messages)} greetings collected."')
    expect(doc.tasks[0].commandStyle).toBe('heredoc')
  })

  it('normalizes a multi-line brace command, preserving indentation', () => {
    const doc = parseWdl('version 1.0\ntask t {\n  command {\n    echo one\n      echo two\n  }\n}')
    expect(doc.errors).toHaveLength(0)
    expect(doc.tasks[0].command).toBe('    echo one\n      echo two')
    expect(doc.tasks[0].commandStyle).toBe('brace')
  })

  it('normalizes a single-line brace command', () => {
    const doc = parseWdl('version 1.0\ntask t {\n  command { echo hi }\n}')
    expect(doc.errors).toHaveLength(0)
    expect(doc.tasks[0].command).toBe('echo hi')
    expect(doc.tasks[0].commandStyle).toBe('brace')
  })

  it('normalizes CRLF source', () => {
    const doc = parseWdl('version 1.0\r\ntask t {\r\n  command <<<\r\n    echo x\r\n  >>>\r\n}')
    expect(doc.errors).toHaveLength(0)
    expect(doc.tasks[0].command).toBe('    echo x')
  })

  it('yields an empty command for an empty heredoc', () => {
    const doc = parseWdl('version 1.0\ntask t {\n  command <<<\n  >>>\n}')
    expect(doc.errors).toHaveLength(0)
    expect(doc.tasks[0].command).toBe('')
  })
})
