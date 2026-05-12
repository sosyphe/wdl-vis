<template>
  <g
    class="wdl-port"
    :transform="`translate(${x},${y})`"
    @mouseenter="onEnter"
    @mouseleave="hovered = false"
  >
    <circle
      ref="circleEl"
      :r="6"
      :class="['port-circle', `port-${side}`, { hovered }]"
    />

    <Teleport to="body">
      <div
        v-if="hovered"
        class="port-tooltip"
        :style="{ left: `${tooltipX}px`, top: `${tooltipY}px` }"
      >
        <span class="tooltip-name">{{ portDef.name }}</span>
        <span class="tooltip-sep">:</span>
        <span class="tooltip-type">{{ portDef.type }}</span>
      </div>
    </Teleport>
  </g>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { PortDef } from '../graph/graph-model'

defineProps<{
  x: number
  y: number
  portDef: PortDef
  side: 'input' | 'output'
}>()

const hovered = ref(false)
const tooltipX = ref(0)
const tooltipY = ref(0)
const circleEl = ref<SVGCircleElement | null>(null)

function onEnter() {
  hovered.value = true
  if (circleEl.value) {
    const rect = circleEl.value.getBoundingClientRect()
    tooltipX.value = rect.left + rect.width / 2
    tooltipY.value = rect.top - 8
  }
}
</script>

<style scoped>
.port-circle {
  fill: #fff;
  stroke: #7c8cbe;
  stroke-width: 1.5;
  cursor: crosshair;
  transition: r 0.1s;
}
.port-circle.hovered {
  r: 8;
  fill: #c4cdf5;
}
.port-input { stroke: #5a9bd5; }
.port-output { stroke: #5ab57f; }
</style>

<style>
.port-tooltip {
  position: fixed;
  transform: translateX(-50%) translateY(-100%);
  background: #fff;
  border: 1px solid #c0c8e8;
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 11px;
  font-family: monospace;
  color: #333;
  pointer-events: none;
  z-index: 9999;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  display: flex;
  align-items: center;
  gap: 3px;
}
.tooltip-name { font-weight: 600; color: #3a6096; }
.tooltip-sep  { color: #aaa; }
.tooltip-type { color: #888; }
</style>
