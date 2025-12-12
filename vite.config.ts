import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  base: '/pl-form-comparison',
  plugins: [tsconfigPaths(), reactRouter(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './app'),
    },
  },
})
