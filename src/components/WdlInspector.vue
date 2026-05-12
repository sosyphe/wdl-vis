<template>
  <div
    class="wdl-inspector"
    :class="{ open: !!node }"
    :style="{ left: inspectorLeft, height: open ? panelHeight + 'px' : '0' }"
  >
    <!-- Drag handle -->
    <div class="drag-handle" @pointerdown="onDragStart" />

    <div class="inspector-header">
      <span class="inspector-title">{{ node?.label }}</span>
      <button class="inspector-close" @click="$emit('close')">✕</button>
    </div>

    <div v-if="node" class="inspector-body">
      <div class="row-top">
        <!-- Inputs -->
        <div class="section">
          <div class="section-label input-label">INPUT</div>
          <div v-if="node.inputs.length" class="port-list">
            <div v-for="p in node.inputs" :key="p.name" class="port-row">
              <span class="port-type input-type">{{ p.type }}</span>
              <span class="port-name">{{ p.name }}</span>
              <span v-if="p.defaultValue" class="port-default" :title="p.defaultValue">= {{ p.defaultValue }}</span>
            </div>
          </div>
          <div v-else class="empty-msg">No inputs</div>
        </div>

        <!-- Script -->
        <div class="section section-script">
          <div class="section-label script-label">SCRIPT</div>
          <div class="script-scroll">
            <WdlCodeBlock v-if="node.command" :code="node.command" />
            <div v-else class="empty-msg">No command block</div>
          </div>
        </div>

        <!-- Outputs -->
        <div class="section">
          <div class="section-label output-label">OUTPUT</div>
          <div v-if="node.outputs.length" class="port-list">
            <div v-for="p in node.outputs" :key="p.name" class="port-row">
              <span class="port-type output-type">{{ p.type }}</span>
              <span class="port-name">{{ p.name }}</span>
              <span v-if="p.defaultValue" class="port-default" :title="p.defaultValue">= {{ p.defaultValue }}</span>
            </div>
          </div>
          <div v-else class="empty-msg">No outputs</div>
        </div>
      </div>

      <!-- Runtime row -->
      <div v-if="runtimeEntries.length" class="row-runtime">
        <span class="section-label runtime-label">RUNTIME</span>
        <div class="runtime-list">
          <div v-for="[k, v] in runtimeEntries" :key="k" class="port-row">
            <span class="runtime-key">{{ k }}</span>
            <span class="runtime-val">{{ v }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { WdlNode } from '../graph/graph-model'
import WdlCodeBlock from './WdlCodeBlock.vue'

const props = defineProps<{
  node: WdlNode | null
  inspectorLeft?: string
}>()
defineEmits<{ (e: 'close'): void }>()

const open = computed(() => !!props.node)
const panelHeight = ref(0)

function defaultHeight() { return Math.round(window.innerHeight * 0.35) }
function maxHeight()     { return Math.round(window.innerHeight * 0.85) }

watch(open, (val) => { if (val) panelHeight.value = defaultHeight() })

const runtimeEntries = computed(() =>
  props.node?.runtimeInfo ? Object.entries(props.node.runtimeInfo) : []
)

let dragStartY = 0
let dragStartHeight = 0

function onDragStart(e: PointerEvent) {
  dragStartY = e.clientY
  dragStartHeight = panelHeight.value
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd, { once: true })
}

function onDragMove(e: PointerEvent) {
  const dy = dragStartY - e.clientY
  panelHeight.value = Math.min(maxHeight(), Math.max(120, dragStartHeight + dy))
}

function onDragEnd() {
  window.removeEventListener('pointermove', onDragMove)
}
</script>

<style scoped>
.wdl-inspector {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 0;
  overflow: hidden;
  background: #fff;
  border-top: 2px solid #dde2f5;
  transition: left 0.2s ease;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  box-shadow: 0 -4px 24px rgba(74, 108, 247, 0.12);
}

.drag-handle {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 6px;
  cursor: ns-resize;
  background: transparent;
  z-index: 1;
}
.drag-handle:hover {
  background: rgba(74, 108, 247, 0.12);
}

.inspector-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f8f9ff;
  border-bottom: 1px solid #dde2f5;
  flex-shrink: 0;
  height: 34px;
  padding: 0 12px 0 14px;
}
.inspector-title {
  font-size: 12px;
  font-weight: 600;
  color: #4a6cf7;
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.inspector-close {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 6px;
  border-radius: 3px;
  line-height: 1;
}
.inspector-close:hover { background: #eef0ff; color: #4a6cf7; }

.inspector-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

/* ── Top row: INPUT | SCRIPT | OUTPUT ── */
.row-top {
  flex: 1;
  display: flex;
  flex-direction: row;
  min-height: 0;
  overflow: hidden;
  border-bottom: 1px solid #eef0f8;
}

.section {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 8px 10px;
  border-right: 1px solid #eef0f8;
  min-width: 0;
  overflow: auto;
}
.section-script { flex: 2; }
.section:last-child { border-right: none; }

.script-scroll {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

/* ── Bottom row: RUNTIME (fixed height, internal scroll) ── */
.row-runtime {
  flex: 0 0 100px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 6px 10px;
  background: #fffaf5;
  border-top: 1px solid #f0dcc0;
  overflow: hidden;
}

.runtime-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  overflow-y: auto;
  height: 100%;
}

.section-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  margin-bottom: 6px;
  flex-shrink: 0;
}
/* In runtime row the label has no bottom margin */
.row-runtime .section-label { margin-bottom: 0; }

.input-label   { color: #5a9bd5; }
.script-label  { color: #888; }
.output-label  { color: #5ab57f; }
.runtime-label { color: #c07a30; }

.port-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.port-row {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  gap: 5px;
  white-space: nowrap;
}
.port-type {
  font-family: monospace;
  font-size: 10px;
  font-weight: 600;
  flex-shrink: 0;
  padding: 1px 4px;
  border-radius: 3px;
}
.input-type  { color: #3a7cc8; background: #eaf2fb; }
.output-type { color: #2e8f58; background: #e8f7ee; }
.port-name {
  font-family: monospace;
  font-size: 12px;
  color: #333;
  white-space: nowrap;
  flex-shrink: 0;
}
.port-default {
  font-family: monospace;
  font-size: 10px;
  color: #e06c2c;
  background: #fff5ee;
  padding: 1px 4px;
  border-radius: 3px;
  white-space: nowrap;
  flex-shrink: 0;
}
.runtime-key {
  font-family: monospace;
  font-size: 11px;
  color: #c07a30;
  font-weight: 600;
  white-space: nowrap;
}
.runtime-val {
  font-family: monospace;
  font-size: 11px;
  color: #555;
  white-space: nowrap;
}
.empty-msg {
  color: #bbb;
  font-size: 11px;
  font-style: italic;
}
</style>
