import { _electron as electron, expect, test } from '@playwright/test'

test('production Electron build opens the local notebook shelf', async () => {
  const environment: Record<string, string> = {}
  for (const [name, value] of Object.entries(process.env)) {
    if (value !== undefined) environment[name] = value
  }
  const executablePath = environment.ELECTRON_EXECUTABLE_PATH
  delete environment.ELECTRON_EXECUTABLE_PATH
  delete environment.VITE_DEV_SERVER_URL

  const electronApp = executablePath
    ? await electron.launch({ executablePath, env: environment })
    : await electron.launch({ args: ['.'], env: environment })

  try {
    const window = await electronApp.firstWindow()
    await window.waitForLoadState('domcontentloaded')

    expect(new URL(window.url()).protocol).toBe('file:')
    await expect(window.getByTestId('shelf')).toBeVisible()
    await expect(window.getByRole('heading', { level: 1, name: 'Lined Notebook' })).toBeVisible()
  } finally {
    await electronApp.close()
  }
})
