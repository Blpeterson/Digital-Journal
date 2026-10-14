import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('notebookAPI', {
  openDialog: () => ipcRenderer.invoke('dialog:open'),
  save: (notebook: unknown, passcode?: string) => ipcRenderer.invoke('notebook:save', notebook, passcode),
  load: (path: string, passcode?: string) => ipcRenderer.invoke('notebook:load', path, passcode),
  list: () => ipcRenderer.invoke('notebook:list'),
  exportPdf: (title: string, notebook: unknown) => ipcRenderer.invoke('notebook:exportPdf', title, notebook),
  choosePhoto: () => ipcRenderer.invoke('photo:choose'),
  printNotebook: () => ipcRenderer.invoke('print:notebook'),
})
