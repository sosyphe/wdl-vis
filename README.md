# wdl-viewer

[![npm version](https://img.shields.io/npm/v/wdl-viewer)](https://www.npmjs.com/package/wdl-viewer)
[![npm downloads](https://img.shields.io/npm/dm/wdl-viewer)](https://www.npmjs.com/package/wdl-viewer)

A Vue 3 component library for parsing and visualizing [WDL](https://openwdl.org/) (Workflow Description Language) workflows as interactive graphs.

![screenshot](https://raw.githubusercontent.com/sosyphe/wdl-vis/main/docs/images/index.png)

## Usage

```bash
npm install wdl-viewer
```

## Docker

Builds and serves the demo app with Nginx:

```bash
docker build -t wdl-viewer .
docker run -p 8080:80 wdl-viewer
```

### Vue component

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { WdlViewer } from 'wdl-viewer'
import 'wdl-viewer/style.css'

const wdl = ref('version 1.0\n\nworkflow hello {\n  call sayHi\n}\n\ntask sayHi {\n  command {\n    echo hi\n  }\n}')
</script>

<template>
  <WdlViewer :wdl-text="wdl" width="100%" height="600px" />
</template>
```

`WdlViewer` also accepts `readonly`, `initialLayout` (`LR` / `TB` / `RL` / `BT`)
and `inspectorLeft`, and emits `parseError`, `nodeSelect` and `edgeSelect`.

### Parser only (no Vue)

`wdl-viewer/parser` is a separate entry point that pulls in neither Vue nor the
graph layout code, so it can be used from a CLI or a Node script:

```ts
import { parseWdl, findWorkflowBlock, findTaskBlock } from 'wdl-viewer/parser'

const doc = parseWdl(source)
console.log(doc.workflow?.name, doc.tasks.map((t) => t.name), doc.errors)

// Byte-offset ranges, for "jump to source" style features.
findWorkflowBlock(source)          // → { start, end } | null
findTaskBlock(source, 'sayHi')     // → { start, end } | null
```

TypeScript declarations ship for both entry points.


## Development

```bash
# NodeJS v24.13.0
npm test             # run tests
npm run dev          # dev server
npm run build        # build library + demo
npm run build:lib    # library only: dist bundles + .d.ts into dist/types
npm run typecheck    # vue-tsc --noEmit
```

## License

[MIT](LICENSE)
