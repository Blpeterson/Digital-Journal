import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { listNotebooks, listRecoveries, loadNotebook, restoreRecovery, saveNotebook, writeNotebookCopy } from './storage'
import type { Notebook } from '../../packages/schema'

let window: BrowserWindow | null = null

async function createWindow() {
  window = new BrowserWindow({
    width: 1400, height: 900, minWidth: 720, minHeight: 600, backgroundColor: '#463a31',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false },
  })
  const devServerUrl = app.isPackaged ? undefined : process.env.VITE_DEV_SERVER_URL
  if (devServerUrl) await window.loadURL(devServerUrl)
  else await window.loadFile(join(__dirname, '../../renderer/index.html'))
}

void app.whenReady().then(createWindow).catch((error: unknown) => {
  const detail = error instanceof Error ? error.message : String(error)
  console.error('Unable to create the Lined Notebook window:', error)
  dialog.showErrorBox('Lined Notebook could not start', `The application could not load its interface.\n\n${detail}`)
  app.quit()
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) void createWindow() })

ipcMain.handle('dialog:open', () => dialog.showOpenDialog(window!, { filters: [{ name: 'Lined Notebook', extensions: ['lnb'] }], properties: ['openFile'] }))
ipcMain.handle('notebook:save', (_event, notebook: Notebook, passcode?: string) => saveNotebook(notebook, passcode))
ipcMain.handle('notebook:load', (_event, path: string, passcode?: string) => loadNotebook(path, passcode))
ipcMain.handle('notebook:list', () => listNotebooks())
ipcMain.handle('recovery:list', () => listRecoveries())
ipcMain.handle('recovery:restore', (_event, id: string) => restoreRecovery(id))
ipcMain.handle('notebook:backupCopy', async (_event, notebook: Notebook, passcode?: string) => {
  if (!window) throw new Error('Window unavailable')
  const result = await dialog.showSaveDialog(window, { defaultPath: `${notebook.title}.lnb`, filters: [{ name: 'Lined Notebook', extensions: ['lnb'] }] })
  if (result.canceled || !result.filePath) return null
  return writeNotebookCopy(result.filePath, notebook, passcode)
})
ipcMain.handle('photo:choose', async () => {
  if (!window) return null
  const result = await dialog.showOpenDialog(window, { filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }], properties: ['openFile'] })
  if (result.canceled || !result.filePaths[0]) return null
  const path = result.filePaths[0]
  const extension = path.split('.').pop()?.toLowerCase() === 'jpg' ? 'jpeg' : path.split('.').pop()?.toLowerCase()
  if (!extension || !['png', 'jpeg', 'webp', 'gif'].includes(extension)) throw new Error('Unsupported image type')
  const bytes = await readFile(path)
  if (bytes.byteLength > 12 * 1024 * 1024) throw new Error('Please choose an image smaller than 12 MB')
  return { name: path.split(/[\\/]/).pop() ?? 'Photo', dataUrl: `data:image/${extension};base64,${bytes.toString('base64')}` }
})
type PrintOptions = { from: number; to: number; includeCovers: boolean; paperSize: 'A4' | 'Letter' }
let printPayload: { notebook: Notebook; options: PrintOptions } | null = null
ipcMain.handle('print:notebook', () => printPayload)
ipcMain.handle('notebook:exportPdf', async (_event, title: string, notebook: Notebook, options: PrintOptions) => {
  if (!window) throw new Error('Window unavailable')
  const result = await dialog.showSaveDialog(window, { defaultPath: `${title}.pdf`, filters: [{ name: 'PDF', extensions: ['pdf'] }] })
  if (result.canceled || !result.filePath) return null
  printPayload = { notebook, options }
  const printWindow = new BrowserWindow({ show: false, webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false } })
  try {
    const devServerUrl = app.isPackaged ? undefined : process.env.VITE_DEV_SERVER_URL
    if (devServerUrl) await printWindow.loadURL(`${devServerUrl}?print=1`)
    else await printWindow.loadFile(join(__dirname, '../../renderer/index.html'), { query: { print: '1' } })
    await printWindow.webContents.executeJavaScript(`Promise.all([document.fonts.ready, new Promise((resolve, reject) => { const started = Date.now(); const check = () => { if (document.querySelectorAll('.print-document .notebook-page').length === ${options.to - options.from + 1}) resolve(true); else if (Date.now() - started > 10000) reject(new Error('Print layout timed out')); else setTimeout(check, 50) }; check() })]).then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))`)
    const data = await printWindow.webContents.printToPDF({ printBackground: true, pageSize: options.paperSize, preferCSSPageSize: true, generateTaggedPDF: true, generateDocumentOutline: true })
    await writeFile(result.filePath, data)
    return result.filePath
  } finally { printPayload = null; printWindow.destroy() }
})
