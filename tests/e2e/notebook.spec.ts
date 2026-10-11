import { expect, test } from '@playwright/test'

test('creates a notebook and preserves spread content across the responsive threshold', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173')
  await page.getByRole('button', { name: 'New notebook' }).click()
  await page.getByLabel('Title').fill('Visual acceptance')
  await page.getByRole('button', { name: 'Create' }).click()
  await page.getByRole('button', { name: 'Visual acceptance' }).click()
  const editor = page.locator('.tiptap').first()
  await editor.fill('The first line stays with the page.')
  await expect(page.locator('.notebook-page')).toHaveCount(2)
  await page.setViewportSize({ width: 800, height: 900 })
  await expect(page.locator('.notebook-page:visible')).toHaveCount(1)
  await expect(editor).toContainText('The first line stays with the page.')
  await expect(page).toHaveScreenshot('lined-page-responsive.png', { animations: 'disabled' })
})
