import { defineConfig } from '@playwright/test'
export default defineConfig({ testDir: './tests/e2e', use: { viewport: { width: 1400, height: 900 } }, webServer: { command: 'npx vite --host 127.0.0.1', url: 'http://127.0.0.1:5173', reuseExistingServer: true } })
