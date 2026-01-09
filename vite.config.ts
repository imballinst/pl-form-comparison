import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

const BASE = 'pl-form-comparison'

export default defineConfig({
  base: '/',
  build: {
    outDir: `build/${BASE}`,
    assetsDir: `${BASE}/assets`,
  },
  plugins: [tsconfigPaths(), reactRouter(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './app'),
    },
  },
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
  },
})
