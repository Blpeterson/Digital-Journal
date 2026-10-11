import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('notebookAPI', {
  openDialog: () => ipcRenderer.invoke('dialog:open'),
  save: (notebook: unknown, passcode?: string) => ipcRenderer.invoke('notebook:save', notebook, passcode),
  load: (path: string, passcode?: string) => ipcRenderer.invoke('notebook:load', path, passcode),
  exportPdf: (title: string) => ipcRenderer.invoke('notebook:exportPdf', title),
})
