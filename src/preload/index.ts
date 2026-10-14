import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('notebookAPI', {
  openDialog: () => ipcRenderer.invoke('dialog:open'),
  save: (notebook: unknown, passcode?: string) => ipcRenderer.invoke('notebook:save', notebook, passcode),
  load: (path: string, passcode?: string) => ipcRenderer.invoke('notebook:load', path, passcode),
  list: () => ipcRenderer.invoke('notebook:list'),
  listRecoveries: () => ipcRenderer.invoke('recovery:list'),
  restoreRecovery: (id: string) => ipcRenderer.invoke('recovery:restore', id),
  backupCopy: (notebook: unknown, passcode?: string) => ipcRenderer.invoke('notebook:backupCopy', notebook, passcode),
  exportPdf: (title: string, notebook: unknown, options: unknown) => ipcRenderer.invoke('notebook:exportPdf', title, notebook, options),
  choosePhoto: () => ipcRenderer.invoke('photo:choose'),
  printNotebook: () => ipcRenderer.invoke('print:notebook'),
})
