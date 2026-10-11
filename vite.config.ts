import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@schema': resolve(__dirname, 'packages/schema/index.ts') } },
  build: { outDir: 'dist/renderer', emptyOutDir: false },
})
