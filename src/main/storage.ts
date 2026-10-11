import { app } from 'electron'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomBytes, scrypt as scryptCallback, createCipheriv, createDecipheriv } from 'node:crypto'
import { promisify } from 'node:util'
import { notebookSchema, type Notebook } from '../../packages/schema'

const scrypt = promisify(scryptCallback)
const MAGIC = 'LNB1'
type Envelope = { magic: typeof MAGIC; encrypted: boolean; salt?: string; iv?: string; tag?: string; payload: string }

export function libraryPath() { return join(app.getPath('documents'), 'Lined Notebooks') }
export function notebookPath(id: string) { return join(libraryPath(), `${id}.lnb`) }

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

export async function saveNotebook(notebook: Notebook, passcode?: string) {
  await mkdir(libraryPath(), { recursive: true })
  const target = notebookPath(notebook.id), temp = `${target}.tmp`
  await writeFile(temp, await encode(notebookSchema.parse(notebook), passcode), { encoding: 'utf8', flag: 'w' })
  await rename(temp, target)
  return target
}
export async function loadNotebook(path: string, passcode?: string) { return decode(await readFile(path, 'utf8'), passcode) }

export const cryptoForTests = { encode, decode }
