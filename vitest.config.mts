import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { include: ['packages/**/*.test.ts', 'src/main/**/*.test.ts'], environment: 'node' },
})
