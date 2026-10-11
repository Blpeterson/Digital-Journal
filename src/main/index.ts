import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'node:path'
import { loadNotebook, saveNotebook } from './storage'
import type { Notebook } from '../../packages/schema'

let window: BrowserWindow | null = null

async function createWindow() {
  window = new BrowserWindow({
    width: 1400, height: 900, minWidth: 720, minHeight: 600, backgroundColor: '#463a31',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false },
  })
  if (process.env.VITE_DEV_SERVER_URL) await window.loadURL(process.env.VITE_DEV_SERVER_URL)
  else await window.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) void createWindow() })

ipcMain.handle('dialog:open', () => dialog.showOpenDialog(window!, { filters: [{ name: 'Lined Notebook', extensions: ['lnb'] }], properties: ['openFile'] }))
ipcMain.handle('notebook:save', (_event, notebook: Notebook, passcode?: string) => saveNotebook(notebook, passcode))
ipcMain.handle('notebook:load', (_event, path: string, passcode?: string) => loadNotebook(path, passcode))
ipcMain.handle('notebook:exportPdf', async (_event, title: string) => {
  if (!window) throw new Error('Window unavailable')
  const result = await dialog.showSaveDialog(window, { defaultPath: `${title}.pdf`, filters: [{ name: 'PDF', extensions: ['pdf'] }] })
  if (result.canceled || !result.filePath) return null
  const data = await window.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: { marginType: 'none' } })
  const { writeFile } = await import('node:fs/promises')
  await writeFile(result.filePath, data)
  return result.filePath
})
