import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['uuid'] })],
    build: {
      lib: {
        entry: resolve(__dirname, 'app/electron/main.ts')
      },
      // Do not bundle `ws`: Vite inlines it and throws on optional `bufferutil` (Cortex client).
      rollupOptions: {
        external: ['ws', 'bufferutil', 'utf-8-validate', 'node-pty']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve(__dirname, 'app/electron/preload.ts')
      }
    }
  },
  renderer: {
    root: 'app',
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'app/index.html')
      }
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'app/src')
      }
    },
    plugins: [react()]
  }
})
