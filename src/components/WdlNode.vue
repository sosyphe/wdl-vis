<template>
  <g
    class="wdl-node"
    :data-id="node.id"
    :class="[`kind-${node.kind}`, { selected, conditional: node.conditionalDepth > 0, collapsed: isCollapsed }]"
    :transform="`translate(${node.x},${node.y})`"
    @click.stop="$emit('click', node)"
  >
    <!-- Shadow -->
    <rect
      v-if="node.kind === 'call'"
      :width="node.width"
      :height="effectiveHeight"
      rx="8"
      ry="8"
      class="node-shadow"
      transform="translate(2,3)"
    />

    <!-- Group rect for if/scatter -->
    <rect
      v-if="node.kind === 'if_group' || node.kind === 'scatter_group'"
      :width="node.width"
      :height="effectiveHeight"
      rx="6"
      class="group-rect"
    />

    <!-- Main rect for call/io nodes -->
    <rect
      v-if="node.kind !== 'if_group' && node.kind !== 'scatter_group'"
      :width="node.width"
      :height="effectiveHeight"
      rx="8"
      ry="8"
      class="node-rect"
    />

    <!-- Header band -->
    <rect
      v-if="node.kind === 'call' || node.kind === 'workflow_input' || node.kind === 'workflow_output'"
      :width="node.width"
      :height="HEADER_H"
      rx="8"
      ry="8"
      class="node-header"
    />
    <rect
      v-if="node.kind === 'call' || node.kind === 'workflow_input' || node.kind === 'workflow_output'"
      :width="node.width"
      :y="HEADER_H - 6"
      height="6"
      class="node-header"
    />

    <!-- Label -->
    <text
      :x="(node.width - (canCollapse ? 20 : 0)) / 2"
      :y="HEADER_H / 2 + 1"
      text-anchor="middle"
      dominant-baseline="middle"
      class="node-label"
    >{{ node.label }}</text>

    <!-- Collapse/expand toggle button (only on call nodes with ports) -->
    <g
      v-if="canCollapse"
      class="collapse-toggle"
      :transform="`translate(${node.width - 18}, ${HEADER_H / 2})`"
      @click.stop="toggleCollapse"
    >
      <circle r="7" class="collapse-circle" />
      <text y="1" text-anchor="middle" dominant-baseline="middle" class="collapse-icon">
        {{ collapseIcon }}
      </text>
    </g>

    <!-- Task name sublabel (when aliased) — only when not collapsed -->
    <text
      v-if="!isCollapsed && node.kind === 'call' && node.taskName && node.taskName !== node.label"
      :x="node.width / 2"
      :y="HEADER_H + 12"
      text-anchor="middle"
      class="node-sublabel"
    >({{ node.taskName }})</text>

    <!-- Group label -->
    <text
      v-if="node.kind === 'if_group' || node.kind === 'scatter_group'"
      :x="node.width / 2"
      y="20"
      text-anchor="middle"
      class="group-label"
    >{{ node.label }}</text>

    <!-- Port content — shown in default and expanded states -->
    <template v-if="showPorts">
      <!-- Input port name labels (up to visiblePortCount) -->
      <text
        v-for="(p, i) in node.inputs.slice(0, visiblePortCount)"
        :key="`inlabel-${p.name}`"
        :x="10"
        :y="portY(i) + 4"
        class="port-body-label input-body-label"
      >{{ p.name }}</text>

      <!-- Output port name labels (up to visiblePortCount) -->
      <text
        v-for="(p, i) in node.outputs.slice(0, visiblePortCount)"
        :key="`outlabel-${p.name}`"
        :x="node.width - 10"
        :y="portY(i) + 4"
        text-anchor="end"
        class="port-body-label output-body-label"
      >{{ p.name }}</text>

      <!-- Input port circles -->
      <WdlPort
        v-for="(p, i) in node.inputs.slice(0, visiblePortCount)"
        :key="`in-${p.name}`"
        :x="0"
        :y="portY(i)"
        :portDef="p"
        side="input"
      />

      <!-- Output port circles -->
      <WdlPort
        v-for="(p, i) in node.outputs.slice(0, visiblePortCount)"
        :key="`out-${p.name}`"
        :x="node.width"
        :y="portY(i)"
        :portDef="p"
        side="output"
      />

      <!-- "…N more" hint when default state has hidden ports -->
      <text
        v-if="hasHiddenPorts"
        :x="node.width / 2"
        :y="portY(MAX_VISIBLE_PORTS) - 2"
        text-anchor="middle"
        class="more-ports-hint"
      >… {{ Math.max(node.inputs.length, node.outputs.length) - MAX_VISIBLE_PORTS }} more</text>
    </template>

    <!-- Collapsed state: show port counts -->
    <template v-if="isCollapsed && (node.inputs.length || node.outputs.length)">
      <text
        :x="10"
        :y="HEADER_H + 14"
        class="collapsed-summary input-body-label"
      >▷ {{ node.inputs.length }} in</text>
      <text
        :x="node.width - 10"
        :y="HEADER_H + 14"
        text-anchor="end"
        class="collapsed-summary output-body-label"
      >{{ node.outputs.length }} out ▷</text>
    </template>
  </g>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WdlNode } from '../graph/graph-model'
import WdlPort from './WdlPort.vue'

const props = defineProps<{
  node: WdlNode
  selected: boolean
  expandState: 'default' | 'collapsed' | 'expanded'
}>()

const emit = defineEmits<{
  (e: 'click', node: WdlNode): void
  (e: 'toggleCollapse', nodeId: string): void
}>()

const HEADER_H = 32
const PORT_SPACING = 18
const PORT_BODY_TOP = HEADER_H + 8  // = 40
const MAX_VISIBLE_PORTS = 5
const COLLAPSED_HEIGHT = HEADER_H + 28  // header + count summary line

const canCollapse = computed(() => {
  const portCount = props.node.inputs.length + props.node.outputs.length
  return (props.node.kind === 'call' || props.node.kind === 'workflow_input' || props.node.kind === 'workflow_output') && portCount > 0
})

// Heights for each state
const effectiveHeight = computed(() => {
  if (!canCollapse.value) return props.node.height
  if (props.expandState === 'collapsed') return COLLAPSED_HEIGHT
  if (props.expandState === 'expanded') return props.node.fullHeight
  return props.node.height  // 'default': capped at 5-row height from builder
})

// How many ports are actually visible in the current state
const visiblePortCount = computed(() => {
  const total = Math.max(props.node.inputs.length, props.node.outputs.length)
  if (props.expandState === 'expanded') return total
  return Math.min(total, MAX_VISIBLE_PORTS)
})

const isCollapsed = computed(() => props.expandState === 'collapsed')
const showPorts = computed(() => props.expandState !== 'collapsed' && canCollapse.value)
const hasHiddenPorts = computed(() =>
  props.expandState === 'default' &&
  Math.max(props.node.inputs.length, props.node.outputs.length) > MAX_VISIBLE_PORTS
)

function toggleCollapse() {
  emit('toggleCollapse', props.node.id)
}

function portY(index: number): number {
  return PORT_BODY_TOP + index * PORT_SPACING
}

// Icons show the action that will happen on click:
// default (5 rows showing) → click → collapsed: show ▲ (collapse up)
// collapsed → click → expanded: show ▼ (expand all)
// expanded → click → default: show ⊟ (back to default)
const collapseIcon = computed(() => {
  if (props.expandState === 'default') return '▲'
  if (props.expandState === 'collapsed') return '▼'
  return '↺'
})
</script>

<style scoped>
.wdl-node {
  cursor: grab;
}
.wdl-node:active {
  cursor: grabbing;
}
.node-shadow {
  fill: rgba(0,0,0,0.12);
  stroke: none;
}
.node-rect {
  fill: #f8f9ff;
  stroke: #c0c8e8;
  stroke-width: 1.5;
  transition: stroke 0.15s, filter 0.15s;
}
.node-header {
  fill: #4a6cf7;
}
.kind-workflow_input .node-header { fill: #3ab07a; }
.kind-workflow_output .node-header { fill: #e06c2c; }
.kind-call .node-header { fill: #4a6cf7; }
.node-label {
  font-size: 12px;
  font-weight: 600;
  fill: #fff;
  pointer-events: none;
  font-family: 'Segoe UI', system-ui, sans-serif;
}
.node-sublabel {
  font-size: 10px;
  fill: #888;
  pointer-events: none;
  font-family: monospace;
}
.group-rect {
  fill: rgba(200, 215, 255, 0.15);
  stroke: #a0b0e0;
  stroke-width: 1.5;
  stroke-dasharray: 6 3;
}
.group-label {
  font-size: 11px;
  fill: #6677cc;
  font-weight: 500;
  pointer-events: none;
  font-family: 'Segoe UI', system-ui, sans-serif;
}
.kind-scatter_group .group-rect {
  fill: rgba(200, 240, 215, 0.15);
  stroke: #80c8a0;
}
.kind-scatter_group .group-label { fill: #3a7a5a; }
.wdl-node.conditional .node-rect { stroke-dasharray: 4 2; }
.port-body-label {
  font-size: 9px;
  pointer-events: none;
  font-family: monospace;
  dominant-baseline: middle;
}
.input-body-label { fill: #3a6096; }
.output-body-label { fill: #3a8060; }
.collapsed-summary {
  font-size: 9px;
  pointer-events: none;
  font-family: monospace;
  dominant-baseline: middle;
  opacity: 0.7;
}
.more-ports-hint {
  font-size: 9px;
  fill: #aaa;
  pointer-events: none;
  font-family: monospace;
  dominant-baseline: middle;
  font-style: italic;
}
/* Collapse toggle button */
.collapse-toggle {
  cursor: pointer;
}
.collapse-circle {
  fill: rgba(255,255,255,0.2);
  stroke: rgba(255,255,255,0.5);
  stroke-width: 1;
  transition: fill 0.12s;
}
.collapse-toggle:hover .collapse-circle {
  fill: rgba(255,255,255,0.35);
}
.collapse-icon {
  font-size: 7px;
  fill: #fff;
  pointer-events: none;
  font-weight: 700;
}
</style>
