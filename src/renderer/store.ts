import { create } from 'zustand'
import { createNotebook, type Notebook, type NotebookStyle, type Page, type StickerInstance, type StampInstance } from '@schema'

type Snapshot = { pages: Page[]; cover: Notebook['cover'] }
type History = Snapshot[]
export type PlacementTool = { kind: 'sticker' | 'stamp'; assetId: string } | null
type State = {
  notebook: Notebook | null; open: boolean; pageIndex: number; animations: boolean; selectedId: string | null; placementTool: PlacementTool; passcode?: string; history: History; future: History;
  createNew(title: string, count: number, rulingHeight: number, paperColor: string): void; setNotebook(n: Notebook, passcode?: string): void;
  updatePage(index: number, patch: Partial<Page>): void; updateStyle(patch: Partial<NotebookStyle>): void; updateCover(patch: Partial<Notebook['cover']>): void;
  addSticker(index: number, item: StickerInstance): void; addStamp(index: number, item: StampInstance): void; updateDecoration(index: number, id: string, patch: Partial<StickerInstance | StampInstance>): void; removeDecoration(index: number, id: string): void; selectPlacement(tool: PlacementTool): void;
  turn(delta: number): void; undo(): void; redo(): void;
}
const snapshot = (n: Notebook): Snapshot => ({ pages: structuredClone(n.pages), cover: structuredClone(n.cover) })
export const useNotebook = create<State>((set, get) => ({
  notebook: null, open: false, pageIndex: 0, animations: !matchMedia('(prefers-reduced-motion: reduce)').matches, selectedId: null, placementTool: null, history: [], future: [],
  createNew: (title, count, rulingHeight, paperColor) => set({ notebook: createNotebook(title, count, rulingHeight, paperColor), open: false, pageIndex: 0, history: [], future: [] }),
  setNotebook: (notebook, passcode) => set({ notebook, passcode, open: false, pageIndex: 0, history: [], future: [] }),
  updatePage: (index, patch) => set((s) => s.notebook ? ({ history: [...s.history.slice(-49), snapshot(s.notebook)], future: [], notebook: { ...s.notebook, modifiedAt: new Date().toISOString(), pages: s.notebook.pages.map((p) => p.index === index ? { ...p, ...patch } : p) } }) : s),
  updateStyle: (patch) => set((s) => s.notebook ? ({ notebook: { ...s.notebook, style: { ...s.notebook.style, ...patch }, modifiedAt: new Date().toISOString() } }) : s),
  updateCover: (patch) => set((s) => s.notebook ? ({ history: [...s.history.slice(-49), snapshot(s.notebook)], future: [], notebook: { ...s.notebook, cover: { ...s.notebook.cover, ...patch }, modifiedAt: new Date().toISOString() } }) : s),
  addSticker: (index, item) => get().updatePage(index, { stickers: [...(get().notebook?.pages[index].stickers ?? []), item] }),
  addStamp: (index, item) => get().updatePage(index, { stamps: [...(get().notebook?.pages[index].stamps ?? []), item] }),
  updateDecoration: (index, id, patch) => { const p = get().notebook?.pages[index]; if (p) get().updatePage(index, { stickers: p.stickers.map(x => x.id === id ? { ...x, ...patch } : x), stamps: p.stamps.map(x => x.id === id ? { ...x, ...patch } : x) }) },
  removeDecoration: (index, id) => { const p = get().notebook?.pages[index]; if (p) get().updatePage(index, { stickers: p.stickers.filter(x => x.id !== id), stamps: p.stamps.filter(x => x.id !== id) }) },
  selectPlacement: (placementTool) => set({ placementTool }),
  turn: (delta) => set((s) => ({ pageIndex: Math.max(0, Math.min((s.notebook?.pageCount ?? 1) - 1, s.pageIndex + delta)) })),
  undo: () => set((s) => { if (!s.notebook || !s.history.length) return s; const prior = s.history.at(-1)!; return { notebook: { ...s.notebook, ...prior }, history: s.history.slice(0, -1), future: [snapshot(s.notebook), ...s.future] } }),
  redo: () => set((s) => { if (!s.notebook || !s.future.length) return s; const next = s.future[0]; return { notebook: { ...s.notebook, ...next }, history: [...s.history, snapshot(s.notebook)], future: s.future.slice(1) } }),
}))
