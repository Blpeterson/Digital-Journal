import { describe, expect, it } from 'vitest'
import { createNotebook, FONT_PROFILES, lineCapacity, notebookSchema, RULING_HEIGHTS } from './index'

describe('notebook schema', () => {
  it('creates every fixed page eagerly', () => {
    const notebook = createNotebook('Field notes', 100, RULING_HEIGHTS.college, '#fffdf5')
    expect(notebook.pages).toHaveLength(100)
    expect(notebook.pages.map(p => p.index)).toEqual(Array.from({ length: 100 }, (_, i) => i))
    expect(notebookSchema.parse(notebook)).toEqual(notebook)
  })

  it('rejects a changed page count', () => {
    const notebook = createNotebook('Fixed', 20, RULING_HEIGHTS.wide, '#ffffff')
    notebook.pages.pop()
    expect(() => notebookSchema.parse(notebook)).toThrow(/Page count/)
  })

  it.each(Object.entries(RULING_HEIGHTS))('%s ruling has an integer hard capacity', (_name, height) => {
    expect(lineCapacity(height)).toBe(Math.floor(834 / height))
  })

  it('profiles every selectable font for baseline alignment', () => {
    for (const profile of Object.values(FONT_PROFILES)) {
      expect(profile.baselineOffset).toBeTypeOf('number')
      expect(profile.sizeScale).toBeGreaterThan(0)
      expect(profile.license).toBeTruthy()
    }
  })
})
