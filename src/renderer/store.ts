import { create } from 'zustand'
import { createNotebook, type DrawingStroke, type Notebook, type NotebookStyle, type Page, type PhotoInstance, type StickerInstance, type StampInstance } from '@schema'

type Snapshot = { pages: Page[]; cover: Notebook['cover'] }
type History = Snapshot[]
export type PlacementTool = { kind: 'sticker' | 'stamp'; assetId: string } | null
type State = {
  notebook: Notebook | null; open: boolean; pageIndex: number; turnDirection: 'next' | 'previous'; animations: boolean; sounds: boolean; highContrast: boolean; zoom: number; selectedId: string | null; placementTool: PlacementTool; drawingTool: 'pen' | 'highlighter' | 'eraser' | null; passcode?: string; history: History; future: History;
  createNew(title: string, count: number, rulingHeight: number, paperColor: string): void; setNotebook(n: Notebook, passcode?: string): void;
  updatePage(index: number, patch: Partial<Page>): void; updateStyle(patch: Partial<NotebookStyle>): void; updateCover(patch: Partial<Notebook['cover']>): void;
  addSticker(index: number, item: StickerInstance): void; addStamp(index: number, item: StampInstance): void; addPhoto(index: number, item: PhotoInstance): void; updateDecoration(index: number, id: string, patch: Partial<StickerInstance | StampInstance | PhotoInstance>): void; removeDecoration(index: number, id: string): void; selectPlacement(tool: PlacementTool): void;
  addDrawing(index: number, stroke: DrawingStroke): void; removeDrawing(index: number, id: string): void; selectDrawing(tool: State['drawingTool']): void;
  clearPage(index: number): void; duplicatePage(index: number): void; movePage(index: number, direction: -1 | 1): void;
  turn(direction: number, singlePage?: boolean): void; undo(): void; redo(): void;
}
const snapshot = (n: Notebook): Snapshot => ({ pages: structuredClone(n.pages), cover: structuredClone(n.cover) })
export const useNotebook = create<State>((set, get) => ({
  notebook: null, open: false, pageIndex: 0, turnDirection: 'next', animations: !matchMedia('(prefers-reduced-motion: reduce)').matches, sounds: false, highContrast: false, zoom: 1, selectedId: null, placementTool: null, drawingTool: null, history: [], future: [],
  createNew: (title, count, rulingHeight, paperColor) => set({ notebook: createNotebook(title, count, rulingHeight, paperColor), passcode: undefined, open: false, pageIndex: 0, history: [], future: [] }),
  setNotebook: (notebook, passcode) => set({ notebook, passcode, open: false, pageIndex: 0, history: [], future: [] }),
  updatePage: (index, patch) => set((s) => s.notebook ? ({ history: [...s.history.slice(-49), snapshot(s.notebook)], future: [], notebook: { ...s.notebook, modifiedAt: new Date().toISOString(), pages: s.notebook.pages.map((p) => p.index === index ? { ...p, ...patch } : p) } }) : s),
  updateStyle: (patch) => set((s) => s.notebook ? ({ notebook: { ...s.notebook, style: { ...s.notebook.style, ...patch }, modifiedAt: new Date().toISOString() } }) : s),
  updateCover: (patch) => set((s) => s.notebook ? ({ history: [...s.history.slice(-49), snapshot(s.notebook)], future: [], notebook: { ...s.notebook, cover: { ...s.notebook.cover, ...patch }, modifiedAt: new Date().toISOString() } }) : s),
  addSticker: (index, item) => get().updatePage(index, { stickers: [...(get().notebook?.pages[index].stickers ?? []), item] }),
  addStamp: (index, item) => get().updatePage(index, { stamps: [...(get().notebook?.pages[index].stamps ?? []), item] }),
  addPhoto: (index, item) => get().updatePage(index, { photos: [...(get().notebook?.pages[index].photos ?? []), item] }),
  updateDecoration: (index, id, patch) => { const p = get().notebook?.pages[index]; if (p) get().updatePage(index, { stickers: p.stickers.map(x => x.id === id ? { ...x, ...patch } : x), stamps: p.stamps.map(x => x.id === id ? { ...x, ...patch } : x), photos: (p.photos ?? []).map(x => x.id === id ? { ...x, ...patch } as PhotoInstance : x) }) },
  removeDecoration: (index, id) => { const p = get().notebook?.pages[index]; if (p) get().updatePage(index, { stickers: p.stickers.filter(x => x.id !== id), stamps: p.stamps.filter(x => x.id !== id), photos: (p.photos ?? []).filter(x => x.id !== id) }) },
  selectPlacement: (placementTool) => set({ placementTool }),
  addDrawing: (index, stroke) => { const p = get().notebook?.pages[index]; if (p) get().updatePage(index, { drawings: [...(p.drawings ?? []), stroke] }) },
  removeDrawing: (index, id) => { const p = get().notebook?.pages[index]; if (p) get().updatePage(index, { drawings: (p.drawings ?? []).filter(stroke => stroke.id !== id) }) },
  selectDrawing: (drawingTool) => set({ drawingTool, placementTool: null }),
  clearPage: (index) => set((s) => {
    if (!s.notebook) return s
    const pages = s.notebook.pages.map(page => page.index === index ? { ...page, content: { type: 'doc', content: [{ type: 'paragraph' }] }, stickers: [], stamps: [], photos: [], drawings: [], bookmarked: false } : page)
    return { history: [...s.history.slice(-49), snapshot(s.notebook)], future: [], notebook: { ...s.notebook, pages, modifiedAt: new Date().toISOString() } }
  }),
  duplicatePage: (index) => set((s) => {
    if (!s.notebook) return s
    const pages = [...s.notebook.pages]
    const wasLast = index === pages.length - 1
    const copy = structuredClone(pages[index])
    pages.splice(Math.min(index + 1, pages.length), 0, copy)
    pages.splice(wasLast ? 0 : pages.length - 1, 1)
    const normalized = pages.map((page, pageIndex) => ({ ...page, index: pageIndex }))
    return { history: [...s.history.slice(-49), snapshot(s.notebook)], future: [], notebook: { ...s.notebook, pages: normalized, modifiedAt: new Date().toISOString() } }
  }),
  movePage: (index, direction) => set((s) => {
    if (!s.notebook) return s
    const target = index + direction
    if (target < 0 || target >= s.notebook.pages.length) return s
    const pages = [...s.notebook.pages]; [pages[index], pages[target]] = [pages[target], pages[index]]
    const normalized = pages.map((page, pageIndex) => ({ ...page, index: pageIndex }))
    return { pageIndex: target, history: [...s.history.slice(-49), snapshot(s.notebook)], future: [], notebook: { ...s.notebook, pages: normalized, modifiedAt: new Date().toISOString() } }
  }),
  turn: (direction, singlePage = false) => set((s) => {
    const pageCount = s.notebook?.pageCount ?? 1
    const step = singlePage ? 1 : 2
    const max = Math.max(0, pageCount - (singlePage ? 1 : 2))
    let pageIndex = Math.max(0, Math.min(max, s.pageIndex + direction * step))
    if (!singlePage) pageIndex -= pageIndex % 2
    return { pageIndex, turnDirection: direction < 0 ? 'previous' : 'next' }
  }),
  undo: () => set((s) => { if (!s.notebook || !s.history.length) return s; const prior = s.history.at(-1)!; return { notebook: { ...s.notebook, ...prior }, history: s.history.slice(0, -1), future: [snapshot(s.notebook), ...s.future] } }),
  redo: () => set((s) => { if (!s.notebook || !s.future.length) return s; const next = s.future[0]; return { notebook: { ...s.notebook, ...next }, history: [...s.history, snapshot(s.notebook)], future: s.future.slice(1) } }),
}))
