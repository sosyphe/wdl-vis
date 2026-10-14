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
/*
 * Every colour is a --wdl-code-* custom property falling back to the
 * GitHub-light palette, so standalone consumers render exactly as before while
 * hosts can re-theme the snippet: the VS Code extension defines the tokens per
 * background mode (auto/light/dark) in its webview theme.css.
 */
.wdl-code-block {
  margin: 0;
  padding: 10px 12px;
  background: var(--wdl-code-bg, #f6f8fa);
  border-radius: 4px;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.5;
  overflow: auto;
  white-space: pre;
  color: var(--wdl-code-fg, #24292e);
}
/* highlight.js github-like theme */
:deep(.hljs-keyword)  { color: var(--wdl-code-keyword, #d73a49); font-weight: 600; }
:deep(.hljs-type)     { color: var(--wdl-code-type, #6f42c1); }
:deep(.hljs-title)    { color: var(--wdl-code-title, #005cc5); font-weight: 600; }
:deep(.hljs-string)   { color: var(--wdl-code-string, #032f62); }
:deep(.hljs-number)   { color: var(--wdl-code-number, #005cc5); }
:deep(.hljs-comment)  { color: var(--wdl-code-comment, #6a737d); font-style: italic; }
:deep(.hljs-variable) { color: var(--wdl-code-variable, #e36209); }
:deep(.hljs-literal)  { color: var(--wdl-code-literal, #005cc5); }
</style>
