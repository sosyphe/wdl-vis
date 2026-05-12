<template>
  <div class="wdl-viewer" :style="{ width, height }">
    <!-- Layout toolbar -->
    <div class="layout-toolbar">
      <span class="toolbar-label">Layout:</span>
      <button
        v-for="opt in layoutOptions"
        :key="opt.value"
        :class="['layout-btn', { active: currentLayout === opt.value }]"
        :title="opt.label"
        @click="setLayout(opt.value)"
      >{{ opt.icon }}</button>
    </div>

    <WdlGraph
      class="wdl-graph-area"
      :graph="layoutedGraph"
      :selectedNodeId="selectedNodeId"
      :selectedEdgeId="selectedEdgeId"
      @nodeClick="onNodeClick"
      @edgeClick="onEdgeClick"
      @bgClick="onBgClick"
    />
    <Teleport to="body">
      <WdlInspector
        :node="selectedNode"
        :inspectorLeft="inspectorLeft"
        @close="onBgClick"
      />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { parseWdl } from '../parser/parser'
import { buildGraph } from '../graph/graph-builder'
import { dagreLayout, layoutGraph } from '../graph/layout'
import type { WdlNode, WdlEdge, WdlGraph as WdlGraphData } from '../graph/graph-model'
import WdlGraph from './WdlGraph.vue'
import WdlInspector from './WdlInspector.vue'
import { useSelection } from '../composables/useSelection'

type RankDir = 'LR' | 'TB' | 'RL' | 'BT'

const props = defineProps<{
  wdlText: string
  width?: string
  height?: string
  readonly?: boolean
  initialLayout?: RankDir
  inspectorLeft?: string
}>()

const emit = defineEmits<{
  (e: 'parseError', errors: string[]): void
  (e: 'nodeSelect', node: WdlNode | null): void
  (e: 'edgeSelect', edge: WdlEdge | null): void
}>()

const layoutOptions: { value: RankDir; icon: string; label: string }[] = [
  { value: 'LR', icon: '→', label: 'Left → Right' },
  { value: 'TB', icon: '↓', label: 'Top → Bottom' },
  { value: 'RL', icon: '←', label: 'Right → Left' },
  { value: 'BT', icon: '↑', label: 'Bottom → Top' },
]

const currentLayout = ref<RankDir>(props.initialLayout ?? 'LR')

const { selectedNodeId, selectedEdgeId, selectNode, selectEdge, clearSelection } = useSelection()

const parsedDoc = computed(() => parseWdl(props.wdlText))
const rawGraph = computed(() => buildGraph(parsedDoc.value))
const layoutedGraph = ref<WdlGraphData>({ nodes: [], edges: [], workflowName: '', errors: [] })

async function updateLayout(graph: WdlGraphData, dir: RankDir) {
  try {
    layoutedGraph.value = await dagreLayout(graph, dir)
  } catch {
    layoutedGraph.value = layoutGraph(graph)
  }
}

watch([rawGraph, currentLayout], ([g, dir]) => {
  updateLayout(g, dir as RankDir)
  if (g.errors.length) emit('parseError', g.errors)
}, { immediate: true })

function setLayout(dir: RankDir) {
  currentLayout.value = dir
}

const selectedNode = computed(() => {
  if (!selectedNodeId.value) return null
  return layoutedGraph.value.nodes.find(n => n.id === selectedNodeId.value) ?? null
})

function onNodeClick(node: WdlNode) {
  selectNode(node)
  emit('nodeSelect', node)
}

function onEdgeClick(edge: WdlEdge) {
  selectEdge(edge)
  emit('edgeSelect', edge)
}

function onBgClick() {
  clearSelection()
  emit('nodeSelect', null)
}
</script>

<style scoped>
.wdl-viewer {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: #f5f7ff;
}
.layout-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgba(255,255,255,0.92);
  border-bottom: 1px solid #dde2f5;
  flex-shrink: 0;
  z-index: 5;
}
.toolbar-label {
  font-size: 11px;
  color: #888;
  font-family: 'Segoe UI', system-ui, sans-serif;
  margin-right: 4px;
}
.layout-btn {
  padding: 2px 10px;
  border: 1px solid #c0c8e8;
  border-radius: 4px;
  background: #f8f9ff;
  color: #4a6cf7;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  transition: background 0.12s, border-color 0.12s;
}
.layout-btn:hover {
  background: #eef0ff;
  border-color: #8898cc;
}
.wdl-graph-area {
  flex: 1;
  min-height: 0;
  position: relative;
}
.layout-btn.active {
  background: #4a6cf7;
  color: #fff;
  border-color: #4a6cf7;
}
</style>
