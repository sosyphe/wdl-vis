import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  if (mode === 'demo') {
    return {
      plugins: [vue()],
      root: '.',
      base: '/wdl-vis/',
      build: { outDir: 'demo-dist' }
    }
  }
  return {
    plugins: [vue()],
    // Keep the root test run scoped to this package's tests directory.
    test: {
      include: ['tests/**/*.test.ts']
    },
    build: {
      lib: {
        // Two entries:
        //   vue-wdl-viewer — full library incl. the Vue component (filenames are
        //                    unchanged from 0.1.x so existing consumers keep working)
        //   parser         — Vue-free parser + source locators for tooling
        //                    (exposed as `wdl-viewer/parser`)
        entry: {
          'vue-wdl-viewer': resolve(__dirname, 'src/index.ts'),
          parser: resolve(__dirname, 'src/parser/index.ts')
        },
        formats: ['es', 'cjs'],
        fileName: (format, entryName) =>
          format === 'es' ? `${entryName}.js` : `${entryName}.cjs`
      },
      rollupOptions: {
        external: ['vue']
      },
      cssCodeSplit: false
    }
  }
})
