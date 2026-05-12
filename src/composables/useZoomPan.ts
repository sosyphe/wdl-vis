import { ref, onMounted, onUnmounted } from 'vue'

export interface ZoomPanState {
  zoom: number
  panX: number
  panY: number
}

export function useZoomPan(containerRef: () => SVGSVGElement | null) {
  const zoom = ref(1)
  const panX = ref(40)
  const panY = ref(40)

  let isPanning = false
  let lastX = 0
  let lastY = 0

  function onWheel(e: WheelEvent) {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
    const newZoom = Math.max(0.05, Math.min(5, zoom.value * factor))
    // Zoom toward cursor
    const svg = containerRef()
    if (svg) {
      const rect = svg.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      panX.value = mx - (mx - panX.value) * (newZoom / zoom.value)
      panY.value = my - (my - panY.value) * (newZoom / zoom.value)
    }
    zoom.value = newZoom
  }

  function onPointerDown(e: PointerEvent) {
    // Only pan on empty canvas (not on nodes)
    const target = e.target as Element
    if (target.closest('.wdl-node') || target.closest('.wdl-edge') || target.closest('.wdl-controls')) return
    isPanning = true
    lastX = e.clientX
    lastY = e.clientY
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: PointerEvent) {
    if (!isPanning) return
    panX.value += e.clientX - lastX
    panY.value += e.clientY - lastY
    lastX = e.clientX
    lastY = e.clientY
  }

  function onPointerUp(e: PointerEvent) {
    isPanning = false
    ;(e.currentTarget as Element | null)?.releasePointerCapture?.(e.pointerId)
  }

  function fitToViewport(nodesBbox: { minX: number; minY: number; maxX: number; maxY: number }, svgWidth: number, svgHeight: number) {
    const w = nodesBbox.maxX - nodesBbox.minX
    const h = nodesBbox.maxY - nodesBbox.minY
    if (w === 0 || h === 0) return
    const padding = 60
    const zx = (svgWidth - padding * 2) / w
    const zy = (svgHeight - padding * 2) / h
    zoom.value = Math.min(zx, zy, 2)
    panX.value = padding - nodesBbox.minX * zoom.value
    panY.value = padding - nodesBbox.minY * zoom.value
  }

  function zoomIn() { zoom.value = Math.min(5, zoom.value * 1.2) }
  function zoomOut() { zoom.value = Math.max(0.05, zoom.value / 1.2) }
  function resetZoom() { zoom.value = 1; panX.value = 40; panY.value = 40 }

  return {
    zoom, panX, panY,
    onWheel, onPointerDown, onPointerMove, onPointerUp,
    fitToViewport, zoomIn, zoomOut, resetZoom
  }
}
