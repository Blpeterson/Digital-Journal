import { z } from 'zod'

export const RULING_HEIGHTS = { narrow: 24, college: 30, wide: 38 } as const
export const PAGE_SIZE = { width: 720, height: 960, paddingTop: 72, paddingBottom: 54, marginLeft: 84 } as const
export const FONT_PROFILES = {
  'Notebook Serif': { family: 'Lora, Georgia, serif', baselineOffset: 0, sizeScale: 1, license: 'SIL OFL 1.1' },
  'Friendly Sans': { family: 'Nunito, sans-serif', baselineOffset: 1, sizeScale: .95, license: 'SIL OFL 1.1' },
  'Clear Sans': { family: 'Atkinson Hyperlegible, sans-serif', baselineOffset: 0, sizeScale: .95, license: 'SIL OFL 1.1' },
  'Cursive Note': { family: 'Caveat, cursive', baselineOffset: 2, sizeScale: .9, license: 'SIL OFL 1.1' },
  'Flowing Script': { family: 'Dancing Script, cursive', baselineOffset: 2, sizeScale: .9, license: 'SIL OFL 1.1' },
  'Curvy Script': { family: 'Pacifico, cursive', baselineOffset: 2, sizeScale: .82, license: 'SIL OFL 1.1' },
} as const

export const transformSchema = z.object({
  id: z.string(), assetId: z.string(), x: z.number(), y: z.number(), rotation: z.number(), scale: z.number().positive(), z: z.number(), tint: z.string().optional(),
})
export const stampSchema = transformSchema.omit({ tint: true }).extend({ inkColor: z.string(), seed: z.number() })
export const photoSchema = transformSchema.omit({ assetId: true, tint: true }).extend({
  dataUrl: z.string().startsWith('data:image/'), name: z.string().max(255),
})
export const pageSchema = z.object({
  index: z.number().int().nonnegative(), content: z.any(), stickers: z.array(transformSchema), stamps: z.array(stampSchema), photos: z.array(photoSchema).default([]),
})
export const notebookStyleSchema = z.object({
  paperColor: z.string(), ruling: z.enum(['lined', 'dotted', 'grid', 'blank']), rulingHeight: z.number().min(20).max(48), rulingColor: z.string(), marginLine: z.string(), defaultTextColor: z.string(), defaultFont: z.string(), deskBackground: z.string(),
})
export const coverSchema = z.object({
  material: z.enum(['cloth', 'leather', 'paper']), color: z.string(), texture: z.string(), spineColor: z.string(), band: z.string().optional(),
  label: z.object({ text: z.string(), font: z.string(), color: z.string() }), stickers: z.array(transformSchema), stamps: z.array(stampSchema),
})
export const notebookSummarySchema = z.object({
  path: z.string(), id: z.string(), title: z.string(), pageCount: z.number().int().optional(), modifiedAt: z.string(), encrypted: z.boolean(), cover: coverSchema.optional(),
})
export const notebookSchema = z.object({
  version: z.literal(1), id: z.string(), title: z.string().min(1), pageCount: z.number().int().min(20).max(100), pageSize: z.literal('standard'),
  style: notebookStyleSchema, cover: coverSchema, pages: z.array(pageSchema), createdAt: z.string(), modifiedAt: z.string(),
}).refine((n) => n.pages.length === n.pageCount, 'Page count must remain fixed')

export type Notebook = z.infer<typeof notebookSchema>
export type NotebookStyle = z.infer<typeof notebookStyleSchema>
export type Page = z.infer<typeof pageSchema>
export type StickerInstance = z.infer<typeof transformSchema>
export type StampInstance = z.infer<typeof stampSchema>
export type PhotoInstance = z.infer<typeof photoSchema>
export type NotebookSummary = z.infer<typeof notebookSummarySchema>

export function createNotebook(title: string, pageCount: number, rulingHeight: number, paperColor: string): Notebook {
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  const emptyContent = { type: 'doc', content: [{ type: 'paragraph' }] }
  return notebookSchema.parse({
    version: 1, id, title, pageCount, pageSize: 'standard', createdAt: now, modifiedAt: now,
    style: { paperColor, ruling: 'lined', rulingHeight, rulingColor: '#93abc2', marginLine: '#d99292', defaultTextColor: '#292725', defaultFont: 'Notebook Serif', deskBackground: '#463a31' },
    cover: { material: 'cloth', color: '#385a72', texture: 'woven', spineColor: '#294353', label: { text: title, font: 'Notebook Serif', color: '#292725' }, stickers: [], stamps: [] },
    pages: Array.from({ length: pageCount }, (_, index) => ({ index, content: structuredClone(emptyContent), stickers: [], stamps: [], photos: [] })),
  })
}

export function lineCapacity(rulingHeight: number) { return Math.floor((PAGE_SIZE.height - PAGE_SIZE.paddingTop - PAGE_SIZE.paddingBottom) / rulingHeight) }
