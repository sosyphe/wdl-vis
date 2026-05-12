<template>
  <div class="wdl-graph-container" ref="containerEl">
    <svg
      ref="svgEl"
      class="wdl-graph-svg"
      @wheel.prevent="zp.onWheel"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @click="onSvgClick"
    >
      <defs>
        <marker id="arrow-normal" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M 0 0 L 6 3 L 0 6 z" fill="#8898cc" />
        </marker>
        <marker id="arrow-conditional" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M 0 0 L 6 3 L 0 6 z" fill="#aab8e8" />
        </marker>
      </defs>

      <g :transform="`translate(${zp.panX.value},${zp.panY.value}) scale(${zp.zoom.value})`">
        <!-- Edges -->
        <WdlEdge
          v-for="edge in graph.edges"
          :key="edge.id"
          :edge="edge"
          :nodeMap="displayedNodeMap"
          :expandStateMap="expandStateMap"
          :selected="selectedEdgeId === edge.id"
          @click="onEdgeClick"
        />

        <!-- Nodes -->
        <WdlNode
          v-for="node in displayedNodes"
          :key="node.id"
          v-memo="[node.x, node.y, node.width, node.height, selectedNodeId === node.id, getExpandState(node.id)]"
          :node="node"
          :selected="selectedNodeId === node.id"
          :expandState="getExpandState(node.id)"
          @toggleCollapse="onToggleCollapse"
        />
      </g>

      <!-- Controls overlay -->
      <g class="wdl-controls" transform="translate(10,10)">
        <rect width="32" height="100" rx="4" fill="white" stroke="#dde" />
        <text x="16" y="24" text-anchor="middle" class="ctrl-btn" @click="zp.zoomIn()">+</text>
        <line x1="4" y1="34" x2="28" y2="34" stroke="#dde" />
        <text x="16" y="56" text-anchor="middle" class="ctrl-btn" @click="zp.zoomOut()">−</text>
        <line x1="4" y1="66" x2="28" y2="66" stroke="#dde" />
        <text x="16" y="88" text-anchor="middle" class="ctrl-btn" @click="onFit">⊞</text>
      </g>

      <!-- Empty state -->
      <text v-if="graph.nodes.length === 0" x="50%" y="50%" text-anchor="middle" class="empty-text">
        No WDL workflow loaded
      </text>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, nextTick, watch } from 'vue'
import type { WdlGraph, WdlNode as WdlNodeType, WdlEdge as WdlEdgeType } from '../graph/graph-model'
import { useZoomPan } from '../composables/useZoomPan'
import WdlNode from './WdlNode.vue'
import WdlEdge from './WdlEdge.vue'

const props = defineProps<{
  graph: WdlGraph
  selectedNodeId: string | null
  selectedEdgeId: string | null
}>()

const emit = defineEmits<{
  (e: 'nodeClick', node: WdlNodeType): void
  (e: 'edgeClick', edge: WdlEdgeType): void
  (e: 'bgClick'): void
}>()

const svgEl = ref<SVGSVGElement | null>(null)
const containerEl = ref<HTMLElement | null>(null)
const zp = useZoomPan(() => svgEl.value)

// ── Node drag state (plain vars — transient, not reactive) ──────────────────
let draggingNodeId: string | null = null
let dragStartClientX = 0
let dragStartClientY = 0
let dragStartNodeX = 0
let dragStartNodeY = 0
const DRAG_THRESHOLD = 4
let suppressNextSvgClick = false

// ── Position overrides: keyed by node id, cleared on graph change ───────────
const nodePositionOverrides = reactive(new Map<string, { x: number; y: number }>())

// ── Expand state: 'default' | 'collapsed' | 'expanded', cleared on graph change ──
type ExpandState = 'default' | 'collapsed' | 'expanded'
const expandStateMap = reactive(new Map<string, ExpandState>())

function getExpandState(nodeId: string): ExpandState {
  return expandStateMap.get(nodeId) ?? 'default'
}

function getEffectiveHeight(node: WdlNodeType, state: ExpandState): number {
  const HEADER_H = 32
  const PORT_SPACING = 18
  const PORT_BODY_TOP = HEADER_H + 8
  const MAX_VISIBLE_PORTS = 5
  const COLLAPSED_HEIGHT = HEADER_H + 28
  if (node.kind !== 'call') return node.height
  const portCount = Math.max(node.inputs.length, node.outputs.length)
  if (portCount === 0) return node.height
  if (state === 'collapsed') return COLLAPSED_HEIGHT
  if (state === 'expanded') return node.fullHeight
  return node.height  // default: capped at 5-row
}

function onToggleCollapse(nodeId: string) {
  const cur = getExpandState(nodeId)
  const next: ExpandState = cur === 'default' ? 'collapsed' : cur === 'collapsed' ? 'expanded' : 'default'
  expandStateMap.set(nodeId, next)

  // Reflow: push nodes in the same column down/up based on height change
  const changedNode = props.graph.nodes.find(n => n.id === nodeId)
  if (!changedNode) return

  const oldH = getEffectiveHeight(changedNode, cur)
  const newH = getEffectiveHeight(changedNode, next)
  const deltaH = newH - oldH
  if (deltaH === 0) return

  // Get current position of changed node (may have been overridden by drag)
  const changedPos = nodePositionOverrides.get(nodeId) ?? { x: changedNode.x, y: changedNode.y }

  // Find all visible nodes in the same column (X within ±60px of changed node)
  const COL_TOLERANCE = 60
  const sameColumn = visibleNodes.value.filter(n => {
    if (n.id === nodeId) return false
    const nx = nodePositionOverrides.get(n.id)?.x ?? n.x
    return Math.abs(nx - changedPos.x) < COL_TOLERANCE
  })

  // Push nodes below the changed node
  for (const n of sameColumn) {
    const pos = nodePositionOverrides.get(n.id) ?? { x: n.x, y: n.y }
    if (pos.y > changedPos.y) {
      nodePositionOverrides.set(n.id, { x: pos.x, y: pos.y + deltaH })
    }
  }
}

watch(() => props.graph, () => {
  nodePositionOverrides.clear()
  expandStateMap.clear()
}, { deep: false })

// ── Computed collections ────────────────────────────────────────────────────
const groupNodes = computed(() =>
  props.graph.nodes.filter(n => n.kind === 'if_group' || n.kind === 'scatter_group')
)

const visibleNodes = computed(() =>
  props.graph.nodes.filter(n => n.kind !== 'if_group' && n.kind !== 'scatter_group')
)

// displayedNodes merges layout positions with any active drag override
const displayedNodes = computed(() =>
  visibleNodes.value.map(n => {
    const ov = nodePositionOverrides.get(n.id)
    return ov ? { ...n, x: ov.x, y: ov.y } : n
  })
)

// displayedNodeMap is passed to WdlEdge so edges follow dragged nodes
const displayedNodeMap = computed(() =>
  new Map(props.graph.nodes.map(n => {
    const ov = nodePositionOverrides.get(n.id)
    return [n.id, ov ? { ...n, x: ov.x, y: ov.y } : n]
  }))
)

// ── Pointer event handlers ───────────────────────────────────────────────────
function onPointerDown(e: PointerEvent) {
  const target = e.target as Element
  // If clicking the collapse toggle button, skip drag handling so click fires normally
  if (target.closest('.collapse-toggle')) return
  const nodeEl = target.closest('.wdl-node')
  if (nodeEl) {
    // Start node drag
    const id = nodeEl.getAttribute('data-id')
    if (!id) return
    const node = displayedNodes.value.find(n => n.id === id)
    if (!node) return
    draggingNodeId = id
    dragStartClientX = e.clientX
    dragStartClientY = e.clientY
    dragStartNodeX = node.x
    dragStartNodeY = node.y
    svgEl.value?.setPointerCapture(e.pointerId)
    e.stopPropagation()
    return
  }
  // Delegate canvas pan to zoom/pan composable
  zp.onPointerDown(e)
}

function onPointerMove(e: PointerEvent) {
  if (draggingNodeId !== null) {
    const dx = e.clientX - dragStartClientX
    const dy = e.clientY - dragStartClientY
    if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return
    // Divide by zoom so pixel movement maps to graph-space movement
    nodePositionOverrides.set(draggingNodeId, {
      x: dragStartNodeX + dx / zp.zoom.value,
      y: dragStartNodeY + dy / zp.zoom.value
    })
    return
  }
  zp.onPointerMove(e)
}

function onPointerUp(e: PointerEvent) {
  if (draggingNodeId !== null) {
    const id = draggingNodeId
    draggingNodeId = null
    svgEl.value?.releasePointerCapture(e.pointerId)
    // If total movement was below threshold, treat as a click (pointer capture breaks synthetic click)
    const dx = e.clientX - dragStartClientX
    const dy = e.clientY - dragStartClientY
    if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) {
      const node = displayedNodes.value.find(n => n.id === id)
      if (node) {
        suppressNextSvgClick = true
        emit('nodeClick', node)
      }
    }
    return
  }
  zp.onPointerUp(e)
}

// ── Click handlers ───────────────────────────────────────────────────────────
function onNodeClick(node: WdlNodeType) { emit('nodeClick', node) }
function onEdgeClick(edge: WdlEdgeType) { emit('edgeClick', edge) }
function onSvgClick() {
  if (suppressNextSvgClick) { suppressNextSvgClick = false; return }
  emit('bgClick')
}

// ── Fit to viewport ──────────────────────────────────────────────────────────
function getBbox() {
  if (props.graph.nodes.length === 0) return null
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of props.graph.nodes) {
    const ov = nodePositionOverrides.get(n.id)
    const x = ov?.x ?? n.x
    const y = ov?.y ?? n.y
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + n.width)
    maxY = Math.max(maxY, y + n.height)
  }
  return { minX, minY, maxX, maxY }
}

function onFit() {
  const bbox = getBbox()
  if (!bbox || !svgEl.value) return
  zp.fitToViewport(bbox, svgEl.value.clientWidth, svgEl.value.clientHeight)
}

watch(() => props.graph.workflowName, async () => {
  await nextTick()
  onFit()
})
</script>

<style scoped>
.wdl-graph-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  background: #f5f7ff;
  background-image: radial-gradient(circle, #d0d8f0 1px, transparent 1px);
  background-size: 24px 24px;
}
.wdl-graph-svg {
  width: 100%;
  height: 100%;
  cursor: grab;
}
.wdl-graph-svg:active {
  cursor: grabbing;
}
.group-bg {
  fill: rgba(200,215,255,0.12);
  stroke: #a0b0e0;
  stroke-width: 1;
  stroke-dasharray: 6 3;
}
.group-bg-scatter_group {
  fill: rgba(180,240,210,0.12);
  stroke: #70c090;
}
.ctrl-btn {
  font-size: 16px;
  fill: #4a6cf7;
  cursor: pointer;
  user-select: none;
  font-weight: 700;
}
.ctrl-btn:hover {
  fill: #2a4cd7;
}
.empty-text {
  font-size: 18px;
  fill: #bbc;
  dominant-baseline: middle;
  font-family: 'Segoe UI', system-ui, sans-serif;
}
</style>
