<template>
  <g class="wdl-edge" :class="{ selected, conditional: edge.conditional }">
    <!-- Invisible wider hit area -->
    <path
      :d="pathD"
      fill="none"
      stroke="transparent"
      stroke-width="12"
      class="edge-hit"
      @click.stop="$emit('click', edge)"
    />
    <!-- Visible path -->
    <path
      :d="pathD"
      fill="none"
      class="edge-line"
      :marker-end="`url(#arrow-${edge.conditional ? 'conditional' : 'normal'})`"
    />
  </g>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WdlEdge, WdlNode } from '../graph/graph-model'

const HEADER_H = 32
const PORT_SPACING = 18
const PORT_BODY_TOP = HEADER_H + 8
const COLLAPSED_HEIGHT = HEADER_H + 28
const MAX_VISIBLE_PORTS = 5

type ExpandState = 'default' | 'collapsed' | 'expanded'

const props = defineProps<{
  edge: WdlEdge
  nodeMap: Map<string, WdlNode>
  expandStateMap: Map<string, ExpandState>
  selected: boolean
}>()

defineEmits<{
  (e: 'click', edge: WdlEdge): void
}>()

function getExpandState(nodeId: string): ExpandState {
  return props.expandStateMap.get(nodeId) ?? 'default'
}

function portYForNode(node: WdlNode, portIndex: number, state: ExpandState): number {
  if (state === 'collapsed') {
    return COLLAPSED_HEIGHT / 2
  }
  // default: cap port index at MAX_VISIBLE_PORTS - 1
  const effectiveIdx = state === 'default'
    ? Math.min(portIndex, MAX_VISIBLE_PORTS - 1)
    : portIndex
  return node.y + PORT_BODY_TOP + effectiveIdx * PORT_SPACING
}

const pathD = computed(() => {
  const src = props.nodeMap.get(props.edge.sourceNodeId)
  const tgt = props.nodeMap.get(props.edge.targetNodeId)
  if (!src || !tgt) return ''

  const srcState = getExpandState(src.id)
  const tgtState = getExpandState(tgt.id)

  const srcPortIdx = src.outputs.findIndex(p => p.name === props.edge.sourcePort)
  const tgtPortIdx = tgt.inputs.findIndex(p => p.name === props.edge.targetPort)

  const sy = srcState === 'collapsed'
    ? src.y + COLLAPSED_HEIGHT / 2
    : portYForNode(src, Math.max(0, srcPortIdx), srcState)

  const ty = tgtState === 'collapsed'
    ? tgt.y + COLLAPSED_HEIGHT / 2
    : portYForNode(tgt, Math.max(0, tgtPortIdx), tgtState)

  const sx = src.x + src.width
  const tx = tgt.x
  const dx = Math.max(Math.abs(tx - sx) * 0.5, 60)

  return `M ${sx},${sy} C ${sx + dx},${sy} ${tx - dx},${ty} ${tx},${ty}`
})
</script>

<style scoped>
.wdl-edge {
  pointer-events: none;
}
.edge-hit {
  pointer-events: stroke;
  cursor: pointer;
}
.edge-line {
  stroke: #8898cc;
  stroke-width: 1.5;
  transition: stroke 0.15s, stroke-width 0.15s;
  pointer-events: none;
}
.wdl-edge.conditional .edge-line {
  stroke-dasharray: 6 4;
  stroke: #aab8e8;
}
.wdl-edge.selected .edge-line {
  stroke: #4a6cf7;
  stroke-width: 2.5;
}
.wdl-edge:hover .edge-line {
  stroke: #4a6cf7;
  stroke-width: 2;
}
</style>
