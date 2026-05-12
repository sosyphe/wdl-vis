<template>
  <pre class="wdl-code-block"><code v-html="highlighted" /></pre>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { hljs } from '../utils/wdl-highlight'

const props = defineProps<{ code: string }>()

const highlighted = computed(() =>
  hljs.highlight(props.code, { language: 'wdl' }).value
)
</script>

<style scoped>
.wdl-code-block {
  margin: 0;
  padding: 10px 12px;
  background: #f6f8fa;
  border-radius: 4px;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.5;
  overflow: auto;
  white-space: pre;
  color: #24292e;
}
/* highlight.js github-like theme */
:deep(.hljs-keyword)  { color: #d73a49; font-weight: 600; }
:deep(.hljs-type)     { color: #6f42c1; }
:deep(.hljs-title)    { color: #005cc5; font-weight: 600; }
:deep(.hljs-string)   { color: #032f62; }
:deep(.hljs-number)   { color: #005cc5; }
:deep(.hljs-comment)  { color: #6a737d; font-style: italic; }
:deep(.hljs-variable) { color: #e36209; }
:deep(.hljs-literal)  { color: #005cc5; }
</style>
