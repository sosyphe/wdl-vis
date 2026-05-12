import { defineConfig } from 'vite'
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
    build: {
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        name: 'VueWdlViewer',
        fileName: (format) => `vue-wdl-viewer.${format}.js`
      },
      rollupOptions: {
        external: ['vue'],
        output: { globals: { vue: 'Vue' } }
      },
      cssCodeSplit: false
    }
  }
})
