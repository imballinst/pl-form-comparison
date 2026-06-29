import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { defineConfig } from 'vitest/config'

const BASE = 'pl-form-comparison'

export default defineConfig({
  base: '/',
  build: {
    outDir: `build/${BASE}`,
    assetsDir: `${BASE}/assets`,
  },
  plugins: [!process.env.VITEST && reactRouter(), tailwindcss()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      '@': path.resolve(__dirname, './app'),
      // Correct React 19 entrypoint mapping for profiling
      'react-dom/client': 'react-dom/profiling',
    },
  },
  define: {
    'process.env.__BUILD_TIMESTAMP__': JSON.stringify(new Date().toISOString()),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['vitest.setup.ts'],
  },
})
