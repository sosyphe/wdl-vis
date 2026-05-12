import { describe, it, expect } from 'vitest'
import { findTaskBlock, findCallBlock } from '../src/composables/useTextareaHighlight'

const WDL_WITH_TASKS = `
workflow myWorkflow {
  call preprocess {
    input:
      ref = "hg38"
  }
  call mapping
}

task preprocess {
  input {
    String ref
  }
  command { echo ~{ref} }
  output { File out = "out.txt" }
}

task mapping {
  command { echo mapping }
  output { File out = "map.txt" }
}
`.trimStart()

const WDL_WORKFLOW_ONLY = `
workflow rnaseq {
  call preprocess {
    input:
      ref = "hg38"
  }
  call predealqc
  call mapping as map1
}
`.trimStart()

describe('findTaskBlock', () => {
  it('finds a task definition by name', () => {
    const block = findTaskBlock(WDL_WITH_TASKS, 'preprocess')
    expect(block).not.toBeNull()
    const text = WDL_WITH_TASKS.slice(block!.start, block!.end)
    expect(text).toMatch(/^task preprocess \{/)
    expect(text).toMatch(/\}$/)
  })

  it('returns null when task does not exist', () => {
    expect(findTaskBlock(WDL_WITH_TASKS, 'nonexistent')).toBeNull()
  })

  it('does not match a call statement instead of a task', () => {
    const block = findTaskBlock(WDL_WITH_TASKS, 'preprocess')
    expect(block).not.toBeNull()
    const text = WDL_WITH_TASKS.slice(block!.start, block!.end)
    expect(text).not.toMatch(/^call/)
  })

  it('finds a single-word task with no inputs', () => {
    const block = findTaskBlock(WDL_WITH_TASKS, 'mapping')
    expect(block).not.toBeNull()
    const text = WDL_WITH_TASKS.slice(block!.start, block!.end)
    expect(text).toMatch(/^task mapping \{/)
  })

  it('block start/end span the full task body including closing brace', () => {
    const block = findTaskBlock(WDL_WITH_TASKS, 'preprocess')!
    expect(WDL_WITH_TASKS[block.end - 1]).toBe('}')
  })
})

describe('findCallBlock', () => {
  it('finds a call block with an input body', () => {
    const block = findCallBlock(WDL_WORKFLOW_ONLY, 'preprocess')
    expect(block).not.toBeNull()
    const text = WDL_WORKFLOW_ONLY.slice(block!.start, block!.end)
    expect(text).toMatch(/^call preprocess \{/)
    expect(text).toMatch(/\}$/)
  })

  it('finds a bare call with no block body', () => {
    const block = findCallBlock(WDL_WORKFLOW_ONLY, 'predealqc')
    expect(block).not.toBeNull()
    const text = WDL_WORKFLOW_ONLY.slice(block!.start, block!.end)
    expect(text).toMatch(/^call predealqc/)
  })

  it('finds a call with an alias using callAlias param', () => {
    const block = findCallBlock(WDL_WORKFLOW_ONLY, 'mapping', 'map1')
    expect(block).not.toBeNull()
    const text = WDL_WORKFLOW_ONLY.slice(block!.start, block!.end)
    expect(text).toMatch(/^call mapping as map1/)
  })

  it('returns null when call does not exist', () => {
    expect(findCallBlock(WDL_WORKFLOW_ONLY, 'nonexistent')).toBeNull()
  })

  it('does not match a task definition instead of a call', () => {
    const block = findCallBlock(WDL_WITH_TASKS, 'preprocess')
    expect(block).not.toBeNull()
    const text = WDL_WITH_TASKS.slice(block!.start, block!.end)
    expect(text).toMatch(/^call preprocess/)
  })

  it('prefers task definition over call when both exist (highlightTaskBlock priority)', () => {
    // findTaskBlock should find the task def; findCallBlock finds the call site
    const taskBlock = findTaskBlock(WDL_WITH_TASKS, 'preprocess')!
    const callBlock = findCallBlock(WDL_WITH_TASKS, 'preprocess')!
    const taskText = WDL_WITH_TASKS.slice(taskBlock.start, taskBlock.end)
    const callText = WDL_WITH_TASKS.slice(callBlock.start, callBlock.end)
    expect(taskText).toMatch(/^task preprocess/)
    expect(callText).toMatch(/^call preprocess/)
    // task definition comes after the call in this file
    expect(taskBlock.start).toBeGreaterThan(callBlock.start)
  })
})
