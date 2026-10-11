import { expect, test } from '@playwright/test'

test('shows saved notebooks on the shelf and navigates every page in both layouts', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('http://127.0.0.1:5173')
  await page.getByRole('button', { name: 'New notebook' }).first().click()
  await page.getByLabel('Title').fill('Shelf Test')
  await page.locator('input[type="range"]').fill('20')
  await page.getByRole('button', { name: 'Create' }).click()

  await page.getByRole('button', { name: 'Shelf', exact: true }).click()
  await expect(page.getByTestId('notebook-card')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Open Shelf Test' })).toBeVisible()
  await expect(page.getByText('Documents/Lined Notebooks')).toBeVisible()
  await expect(page).toHaveScreenshot('bookshelf.png', { animations: 'disabled' })

  await page.getByRole('button', { name: 'Open Shelf Test' }).click()
  await page.locator('.closed-notebook').click()
  await expect(page.getByText('Pages 1–2 of 20')).toBeVisible()
  await page.getByTestId('page-turn-next').click()
  await expect(page.getByText('Pages 3–4 of 20')).toBeVisible()
  const animationName = await page.locator('.notebook-page').first().evaluate(element => getComputedStyle(element).animationName)
  expect(animationName).toContain('page-next')

  await test.step('arrow keys stay in the editor', async () => {
    await page.locator('.tiptap').first().focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByText('Pages 3–4 of 20')).toBeVisible()
  })

  await test.step('advance to the final spread', async () => {
    for (let turn = 0; turn < 8; turn++) await page.getByTestId('page-turn-next').click()
  })
  await expect(page.getByText('Pages 19–20 of 20')).toBeVisible()
  await expect(page.getByTestId('page-turn-next')).toBeDisabled()
  await expect(page.locator('.page-number')).toHaveText(['19', '20'])

  await page.getByRole('button', { name: 'Shelf', exact: true }).click()
  await page.setViewportSize({ width: 800, height: 900 })
  await page.getByRole('button', { name: 'Open Shelf Test' }).click()
  await page.locator('.closed-notebook').click()
  await expect(page.getByText('Page 1 of 20')).toBeVisible()
  await page.getByTestId('page-turn-next').click()
  await expect(page.getByText('Page 2 of 20')).toBeVisible()
  await page.getByTestId('page-turn-next').click()
  await expect(page.getByText('Page 3 of 20')).toBeVisible()
  await page.getByTestId('page-turn-previous').click()
  await expect(page.getByText('Page 2 of 20')).toBeVisible()
})

test('loads every bundled font and offers all font profiles', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173')
  await page.getByRole('button', { name: 'New notebook' }).first().click()
  await page.getByRole('button', { name: 'Create' }).click()
  await page.locator('.closed-notebook').click()
  await page.locator('.tiptap').first().fill('Font loading check')

  const fontSelector = page.getByLabel('Font').first()
  await expect(fontSelector.locator('option')).toHaveCount(7)
  const families = ['Lora', 'Nunito', 'Atkinson Hyperlegible', 'Caveat', 'Dancing Script', 'Pacifico']
  for (const family of families) {
    const loadedFaces = await page.evaluate(async name => (await document.fonts.load(`16px "${name}"`)).length, family)
    expect(loadedFaces, `${family} should load from the app bundle`).toBeGreaterThan(0)
  }
})
