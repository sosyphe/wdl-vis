import { describe, it, expect } from 'vitest'
import {
  findTaskBlock,
  findCallBlock,
  findWorkflowBlock,
  findBlockWithin,
} from '../src/parser/locate'

const SAMPLE = `version 1.0

workflow HelloWorld {
  input {
    String name = "World"
    Int repeat = 3
  }

  scatter (i in range(repeat)) {
    call sayHello {
      input:
        greeting = name,
        index = i
    }
  }

  call collectResults {
    input:
      messages = sayHello.message
  }

  output {
    Array[String] greetings = sayHello.message
  }
}

task sayHello {
  input {
    String greeting
  }

  command <<<
    echo "Hello, ~{greeting}"
  >>>

  output {
    String message = read_string(stdout())
  }

  runtime {
    docker: "ubuntu:20.04"
  }
}
`

/** Slice helper so assertions read like the source they describe. */
function slice(block: { start: number; end: number } | null): string {
  return block === null ? '' : SAMPLE.slice(block.start, block.end)
}

describe('findWorkflowBlock', () => {
  it('finds the only workflow when no name is given', () => {
    const block = findWorkflowBlock(SAMPLE)
    expect(block).not.toBeNull()
    expect(slice(block)).toMatch(/^workflow HelloWorld \{/)
    expect(SAMPLE[block!.end - 1]).toBe('}')
  })

  it('finds a workflow by name', () => {
    const block = findWorkflowBlock(SAMPLE, 'HelloWorld')
    expect(block).not.toBeNull()
    expect(slice(block)).toMatch(/^workflow HelloWorld \{/)
  })

  it('returns null for an unknown workflow name', () => {
    expect(findWorkflowBlock(SAMPLE, 'nope')).toBeNull()
  })

  it('returns null when the document has no workflow', () => {
    expect(findWorkflowBlock('task only {\n  command { true }\n}\n')).toBeNull()
  })

  it('supports an unnamed workflow block', () => {
    const text = 'workflow {\n  call a\n}\n'
    const block = findWorkflowBlock(text)
    expect(block).toEqual({ start: 0, end: text.length - 1 })
  })

  it('stops at the workflow closing brace, not the following task', () => {
    const block = findWorkflowBlock(SAMPLE)!
    const taskStart = SAMPLE.indexOf('task sayHello')
    expect(block.end).toBeLessThanOrEqual(taskStart)
  })

  it('returns null when braces never balance', () => {
    expect(findWorkflowBlock('workflow broken {\n  call a\n')).toBeNull()
  })
})

describe('findTaskBlock', () => {
  it('finds a task definition spanning the full body', () => {
    const block = findTaskBlock(SAMPLE, 'sayHello')
    expect(block).not.toBeNull()
    expect(slice(block)).toMatch(/^task sayHello \{/)
    expect(slice(block)).toMatch(/\}\s*$/)
    expect(SAMPLE[block!.end - 1]).toBe('}')
  })

  it('does not match the call site of the same name', () => {
    expect(slice(findTaskBlock(SAMPLE, 'sayHello'))).not.toMatch(/^call/)
  })

  it('returns null for an unknown task', () => {
    expect(findTaskBlock(SAMPLE, 'nope')).toBeNull()
  })
})

describe('findCallBlock', () => {
  it('finds a call with an input body', () => {
    const block = findCallBlock(SAMPLE, 'sayHello')
    expect(block).not.toBeNull()
    expect(slice(block)).toMatch(/^call sayHello \{/)
    expect(SAMPLE[block!.end - 1]).toBe('}')
  })

  it('finds a bare call and extends it to end of line', () => {
    const text = 'workflow w {\n  call plain\ncall other\n}\n'
    const block = findCallBlock(text, 'plain')!
    expect(text.slice(block.start, block.end)).toBe('call plain')
  })

  it('matches an aliased call when the alias is supplied', () => {
    const text = 'workflow w {\n  call mapping as map1 {\n    input:\n      x = 1\n  }\n}\n'
    const block = findCallBlock(text, 'mapping', 'map1')!
    expect(text.slice(block.start, block.end)).toMatch(/^call mapping as map1 \{/)
  })

  it('returns null for an unknown call', () => {
    expect(findCallBlock(SAMPLE, 'nope')).toBeNull()
  })
})

describe('findBlockWithin', () => {
  it('finds the workflow input block inside the workflow range', () => {
    const wf = findWorkflowBlock(SAMPLE)!
    const input = findBlockWithin(SAMPLE, wf.start, wf.end, 'input')
    expect(input).not.toBeNull()
    expect(SAMPLE.slice(input!.start, input!.end)).toMatch(/^input \{/)
    expect(SAMPLE.slice(input!.start, input!.end)).toContain('String name')
  })

  it('finds the workflow output block, not the task output block', () => {
    const wf = findWorkflowBlock(SAMPLE)!
    const output = findBlockWithin(SAMPLE, wf.start, wf.end, 'output')!
    expect(SAMPLE.slice(output.start, output.end)).toContain('Array[String] greetings')
    expect(output.end).toBeLessThanOrEqual(wf.end)
  })

  it('finds nested task sub-blocks within a task range', () => {
    const task = findTaskBlock(SAMPLE, 'sayHello')!
    const runtime = findBlockWithin(SAMPLE, task.start, task.end, 'runtime')!
    expect(SAMPLE.slice(runtime.start, runtime.end)).toContain('docker')
    expect(runtime.end).toBeLessThanOrEqual(task.end)
  })

  it('ignores colon-form call inputs (`input:` has no brace)', () => {
    const wf = findWorkflowBlock(SAMPLE)!
    const call = findCallBlock(SAMPLE, 'sayHello')!
    // Inside the call there is only `input:` — no `input { ... }` block.
    expect(findBlockWithin(SAMPLE, call.start, call.end, 'input')).toBeNull()
    // ...while the workflow-level `input { ... }` is still found.
    expect(findBlockWithin(SAMPLE, wf.start, wf.end, 'input')).not.toBeNull()
  })

  it('returns null when the window is empty or inverted', () => {
    expect(findBlockWithin(SAMPLE, 10, 10, 'input')).toBeNull()
    expect(findBlockWithin(SAMPLE, 20, 10, 'input')).toBeNull()
  })

  it('returns null when the keyword is absent from the window', () => {
    const wf = findWorkflowBlock(SAMPLE)!
    expect(findBlockWithin(SAMPLE, wf.start, wf.end, 'runtime')).toBeNull()
  })

  it('clamps the window to the document bounds', () => {
    const block = findBlockWithin(SAMPLE, -5, SAMPLE.length + 100, 'input')
    expect(block).not.toBeNull()
    expect(SAMPLE.slice(block!.start, block!.end)).toMatch(/^input \{/)
  })
})
