<template>
  <div class="demo-app">
    <header class="demo-header">
      <div class="demo-logo">
        <span class="logo-icon">⬡</span>
        <span class="logo-text">WDL Workflow Viewer</span>
      </div>
      <div class="demo-controls">
        <button class="btn btn-example" @click="loadExample">
          📋 Sample: Hello World
        </button>
        <label class="btn btn-file">
          📂 Load File
          <input type="file" accept=".wdl" @change="onFileLoad" hidden />
        </label>
      </div>
      <div class="demo-info">
        <span v-if="workflowName" class="workflow-badge">{{ workflowName }}</span>
        <span v-if="nodeCount" class="stat-badge">{{ nodeCount }} nodes</span>
        <span v-if="edgeCount" class="stat-badge">{{ edgeCount }} edges</span>
      </div>
    </header>

    <div class="demo-body">
      <!-- Left: text editor panel -->
      <div class="text-panel" :class="{ collapsed: textPanelCollapsed }">
        <div class="panel-toolbar">
          <span v-if="!textPanelCollapsed" class="panel-title">WDL Source</span>
          <button class="btn-icon" @click="textPanelCollapsed = !textPanelCollapsed" :title="textPanelCollapsed ? 'Expand' : 'Collapse'">
            {{ textPanelCollapsed ? '▶' : '◀' }}
          </button>
        </div>
        <textarea
          ref="textareaRef"
          v-if="!textPanelCollapsed"
          v-model="wdlText"
          class="wdl-textarea"
          placeholder="Paste or type WDL source here...&#10;&#10;Or click one of the example buttons above to get started."
          spellcheck="false"
        />
        <div v-if="errors.length && !textPanelCollapsed" class="error-panel">
          <div class="error-title">⚠ Parse warnings ({{ errors.length }})</div>
          <div v-for="(e, i) in errors.slice(0, 5)" :key="i" class="error-item">{{ e }}</div>
          <div v-if="errors.length > 5" class="error-more">...and {{ errors.length - 5 }} more</div>
        </div>
      </div>

      <!-- Right: graph viewer -->
      <div class="graph-panel">
        <WdlViewer
          :wdl-text="wdlText"
          :inspector-left="inspectorLeft"
          width="100%"
          height="100%"
          @parse-error="onParseError"
          @node-select="onNodeSelect"
          @edge-select="onEdgeSelect"
        />
      </div>
    </div>

    <footer class="demo-footer">
      <span>vue-wdl-viewer · WDL Workflow Visualization</span>
      <span v-if="selectedInfo" class="selected-info">Selected: {{ selectedInfo }}</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import WdlViewer from '../components/WdlViewer.vue'
import { parseWdl } from '../parser/parser'
import { buildGraph } from '../graph/graph-builder'
import type { WdlNode, WdlEdge } from '../graph/graph-model'
import { SAMPLE_WDL } from './examples'
import { useTextareaHighlight } from '../composables/useTextareaHighlight'

const wdlText = ref(SAMPLE_WDL)
const errors = ref<string[]>([])
const textPanelCollapsed = ref(false)
const selectedInfo = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const { highlightTaskBlock } = useTextareaHighlight()

const inspectorLeft = computed(() => textPanelCollapsed.value ? '36px' : '320px')

const parsedInfo = computed(() => {
  const doc = parseWdl(wdlText.value)
  const graph = buildGraph(doc)
  return graph
})

const workflowName = computed(() => parsedInfo.value.workflowName || '')
const nodeCount = computed(() => parsedInfo.value.nodes.filter(n => n.kind === 'call').length)
const edgeCount = computed(() => parsedInfo.value.edges.length)

function loadExample() {
  errors.value = []
  wdlText.value = SAMPLE_WDL
}

async function onFileLoad(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  wdlText.value = await file.text()
  errors.value = []
  ;(e.target as HTMLInputElement).value = ''
}

function onParseError(errs: string[]) {
  errors.value = errs
}

async function onNodeSelect(node: WdlNode | null) {
  selectedInfo.value = node ? `${node.label} (${node.kind})` : ''
  if (node?.kind === 'call' && node.taskName && !textPanelCollapsed.value) {
    await nextTick()
    if (textareaRef.value) {
      highlightTaskBlock(textareaRef.value, wdlText.value, node.taskName)
    }
  }
}

function onEdgeSelect(edge: WdlEdge | null) {
  selectedInfo.value = edge ? `${edge.sourceNodeId}.${edge.sourcePort} → ${edge.targetNodeId}.${edge.targetPort}` : ''
}
</script>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; overflow: hidden; font-family: 'Segoe UI', system-ui, sans-serif; }
#app { height: 100%; display: flex; flex-direction: column; }
</style>

<style scoped>
.demo-app {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f0f2fa;
}
.demo-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: linear-gradient(135deg, #2d3a8c, #4a6cf7);
  color: #fff;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.demo-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 700;
  margin-right: 8px;
}
.logo-icon { font-size: 22px; }
.logo-text { letter-spacing: -0.02em; }
.demo-controls {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.btn {
  padding: 5px 12px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: background 0.15s, transform 0.1s;
  white-space: nowrap;
}
.btn:hover { transform: translateY(-1px); }
.btn-example {
  background: rgba(255,255,255,0.15);
  color: #fff;
  border: 1px solid rgba(255,255,255,0.25);
}
.btn-example:hover { background: rgba(255,255,255,0.25); }
.btn-file {
  background: rgba(255,255,255,0.9);
  color: #2d3a8c;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
}
.demo-info {
  margin-left: auto;
  display: flex;
  gap: 6px;
  align-items: center;
}
.workflow-badge {
  background: rgba(255,255,255,0.2);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 600;
  font-family: monospace;
}
.stat-badge {
  background: rgba(255,255,255,0.12);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 11px;
}
.demo-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}
.text-panel {
  width: 320px;
  min-width: 320px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #dde2f5;
  background: #fff;
  transition: width 0.2s, min-width 0.2s;
}
.text-panel.collapsed {
  width: 36px;
  min-width: 36px;
}
.panel-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: #f5f6ff;
  border-bottom: 1px solid #eef;
  flex-shrink: 0;
  overflow: hidden;
}
.text-panel.collapsed .panel-toolbar {
  justify-content: center;
  padding: 6px 0;
}
.panel-title {
  font-size: 12px;
  font-weight: 600;
  color: #556;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  color: #778;
  padding: 2px 4px;
}
.wdl-textarea {
  flex: 1;
  width: 100%;
  border: none;
  outline: none;
  resize: none;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: 12px;
  line-height: 1.6;
  padding: 12px;
  color: #234;
  background: #fff;
  tab-size: 2;
  white-space: pre;
  overflow: auto;
  overflow-x: scroll;
}
.error-panel {
  background: #fff8f0;
  border-top: 1px solid #f0c090;
  padding: 8px 12px;
  flex-shrink: 0;
}
.error-title {
  font-size: 11px;
  font-weight: 600;
  color: #c07030;
  margin-bottom: 4px;
}
.error-item {
  font-size: 10px;
  color: #a05020;
  font-family: monospace;
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.error-more {
  font-size: 10px;
  color: #c07030;
  font-style: italic;
}
.graph-panel {
  flex: 1;
  overflow: hidden;
  position: relative;
}
.demo-footer {
  padding: 4px 16px;
  background: #eef0f8;
  border-top: 1px solid #dde;
  font-size: 11px;
  color: #889;
  display: flex;
  justify-content: space-between;
  flex-shrink: 0;
}
.selected-info {
  font-family: monospace;
  color: #4a6cf7;
}
</style>
