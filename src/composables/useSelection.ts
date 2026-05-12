import { ref } from 'vue'
import type { WdlNode, WdlEdge } from '../graph/graph-model'

export function useSelection() {
  const selectedNodeId = ref<string | null>(null)
  const selectedEdgeId = ref<string | null>(null)

  function selectNode(node: WdlNode | null) {
    selectedNodeId.value = node?.id ?? null
    selectedEdgeId.value = null
  }

  function selectEdge(edge: WdlEdge | null) {
    selectedEdgeId.value = edge?.id ?? null
    selectedNodeId.value = null
  }

  function clearSelection() {
    selectedNodeId.value = null
    selectedEdgeId.value = null
  }

  return { selectedNodeId, selectedEdgeId, selectNode, selectEdge, clearSelection }
}
