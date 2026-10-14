import React from 'react'
import { createRoot } from 'react-dom/client'
import { App, PrintApp } from './App'
import './styles.css'
import type { Notebook } from '@schema'
import '@fontsource/lora/400.css'
import '@fontsource/lora/700.css'
import '@fontsource/nunito/400.css'
import '@fontsource/nunito/700.css'
import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/700.css'
import '@fontsource/caveat/400.css'
import '@fontsource/caveat/700.css'
import '@fontsource/dancing-script/400.css'
import '@fontsource/dancing-script/700.css'
import '@fontsource/pacifico/400.css'

// Browser-only adapter used by visual tests; production always receives the isolated preload bridge.
if (!window.notebookAPI) {
  window.notebookAPI = {
    openDialog: async () => ({ canceled: true, filePaths: [] }),
    save: async (notebook: Notebook) => { const path = `notebook:${notebook.id}`; localStorage.setItem(path, JSON.stringify(notebook)); return path },
    load: async (path: string) => JSON.parse(localStorage.getItem(path) ?? '{}') as Notebook,
    list: async () => ({ directory: 'Documents/Lined Notebooks', notebooks: Object.keys(localStorage).filter(key => key.startsWith('notebook:')).flatMap(path => { try { const notebook = JSON.parse(localStorage.getItem(path)!) as Notebook; return [{ path, id: notebook.id, title: notebook.title, pageCount: notebook.pageCount, modifiedAt: notebook.modifiedAt, encrypted: false, cover: notebook.cover }] } catch { return [] } }).sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)) }),
    listRecoveries: async () => [],
    restoreRecovery: async () => '',
    backupCopy: async () => null,
    exportPdf: async (_title, notebook, options) => { localStorage.setItem('print:notebook', JSON.stringify({ notebook, options })); return null },
    choosePhoto: async () => null,
    printNotebook: async () => { const raw = localStorage.getItem('print:notebook'); return raw ? JSON.parse(raw) as { notebook: Notebook; options: { from: number; to: number; includeCovers: boolean; paperSize: 'A4' | 'Letter' } } : null },
  }
}

const printing = new URLSearchParams(location.search).has('print')
createRoot(document.getElementById('root')!).render(<React.StrictMode>{printing ? <PrintApp /> : <App />}</React.StrictMode>)
