import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'
import type { Notebook } from '@schema'

// Browser-only adapter used by visual tests; production always receives the isolated preload bridge.
if (!window.notebookAPI) {
  window.notebookAPI = {
    openDialog: async () => ({ canceled: true, filePaths: [] }),
    save: async (notebook: Notebook) => { localStorage.setItem(`notebook:${notebook.id}`, JSON.stringify(notebook)); return notebook.id },
    load: async (path: string) => JSON.parse(localStorage.getItem(path) ?? '{}') as Notebook,
    exportPdf: async () => null,
  }
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
