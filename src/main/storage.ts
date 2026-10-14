import { app } from 'electron'
import { copyFile, mkdir, open, readFile, readdir, rename, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { randomBytes, scrypt as scryptCallback, createCipheriv, createDecipheriv } from 'node:crypto'
import { promisify } from 'node:util'
import { notebookSchema, type Notebook, type NotebookSummary } from '../../packages/schema'

const scrypt = promisify(scryptCallback)
const MAGIC = 'LNB1'
type Envelope = { magic: typeof MAGIC; encrypted: boolean; salt?: string; iv?: string; tag?: string; payload: string }

export function libraryPath() { return join(app.getPath('documents'), 'Lined Notebooks') }
export function notebookPath(id: string) { return join(libraryPath(), `${id}.lnb`) }
const saveQueues = new Map<string, Promise<string>>()

async function encode(notebook: Notebook, passcode?: string): Promise<string> {
  const json = JSON.stringify(notebook)
  if (!passcode) return JSON.stringify({ magic: MAGIC, encrypted: false, payload: Buffer.from(json).toString('base64') } satisfies Envelope)
  const salt = randomBytes(16), iv = randomBytes(12)
  const key = await scrypt(passcode, salt, 32) as Buffer
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(json), cipher.final()])
  return JSON.stringify({ magic: MAGIC, encrypted: true, salt: salt.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), payload: encrypted.toString('base64') } satisfies Envelope)
}

async function decode(raw: string, passcode?: string): Promise<Notebook> {
  const envelope = JSON.parse(raw) as Envelope
  if (envelope.magic !== MAGIC) throw new Error('Not a Lined Notebook file')
  if (!envelope.encrypted) return notebookSchema.parse(JSON.parse(Buffer.from(envelope.payload, 'base64').toString()))
  if (!passcode || !envelope.salt || !envelope.iv || !envelope.tag) throw new Error('PASSCODE_REQUIRED')
  try {
    const key = await scrypt(passcode, Buffer.from(envelope.salt, 'base64'), 32) as Buffer
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'))
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'))
    return notebookSchema.parse(JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.payload, 'base64')), decipher.final()]).toString()))
  } catch { throw new Error('INVALID_PASSCODE') }
}

async function saveNotebookNow(notebook: Notebook, passcode?: string) {
  await mkdir(libraryPath(), { recursive: true })
  const parsed = notebookSchema.parse(notebook)
  const target = notebookPath(parsed.id)
  const temp = `${target}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`
  const backup = `${target}.backup`
  const encoded = await encode(parsed, passcode)
  let handle
  try {
    handle = await open(temp, 'wx', 0o600)
    await handle.writeFile(encoded, 'utf8')
    await handle.sync()
    await handle.close()
    handle = undefined
    await decode(await readFile(temp, 'utf8'), passcode)
    try { await copyFile(target, backup) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
    await rename(temp, target)
    const saved = await decode(await readFile(target, 'utf8'), passcode)
    if (saved.id !== parsed.id || saved.modifiedAt !== parsed.modifiedAt) throw new Error('Saved notebook verification failed')
  } catch (error) {
    if (handle) await handle.close().catch(() => undefined)
    await unlink(temp).catch(() => undefined)
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`Unable to save safely. Your open notebook is still in memory. ${detail}`)
  }
  return target
}
export function saveNotebook(notebook: Notebook, passcode?: string) {
  const previous = saveQueues.get(notebook.id) ?? Promise.resolve('')
  const next = previous.catch(() => '').then(() => saveNotebookNow(notebook, passcode))
  saveQueues.set(notebook.id, next)
  void next.finally(() => { if (saveQueues.get(notebook.id) === next) saveQueues.delete(notebook.id) }).catch(() => undefined)
  return next
}
export async function loadNotebook(path: string, passcode?: string) { return decode(await readFile(path, 'utf8'), passcode) }

export async function listNotebooks(): Promise<{ directory: string; notebooks: NotebookSummary[] }> {
  const directory = libraryPath()
  await mkdir(directory, { recursive: true })
  const entries = await readdir(directory, { withFileTypes: true })
  const summaries = await Promise.all(entries.filter(entry => entry.isFile() && entry.name.endsWith('.lnb')).map(async (entry): Promise<NotebookSummary | null> => {
    const path = join(directory, entry.name)
    try {
      const [raw, details] = await Promise.all([readFile(path, 'utf8'), stat(path)])
      const envelope = JSON.parse(raw) as Envelope
      if (envelope.magic !== MAGIC) return null
      if (envelope.encrypted) return { path, id: entry.name.slice(0, -4), title: 'Locked notebook', modifiedAt: details.mtime.toISOString(), encrypted: true } satisfies NotebookSummary
      const notebook = await decode(raw)
      return { path, id: notebook.id, title: notebook.title, pageCount: notebook.pageCount, modifiedAt: notebook.modifiedAt || details.mtime.toISOString(), encrypted: false, cover: notebook.cover } satisfies NotebookSummary
    } catch { return null }
  }))
  const notebooks: NotebookSummary[] = summaries.filter((summary): summary is NotebookSummary => summary !== null)
  notebooks.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
  return { directory, notebooks }
}

export const cryptoForTests = { encode, decode }
