import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createNotebook, RULING_HEIGHTS } from '../../packages/schema'
import { mkdtemp, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

vi.mock('electron', () => ({ app: { getPath: () => process.env.LNB_TEST_DOCUMENTS ?? 'unused' } }))

describe('encrypted notebook envelope', () => {
  let cryptoForTests: typeof import('./storage').cryptoForTests
  beforeAll(async () => { ({ cryptoForTests } = await import('./storage')) })

  it('round-trips with the right passcode and reveals no plaintext', async () => {
    const notebook = createNotebook('Secret field notes', 20, RULING_HEIGHTS.college, '#ffffff')
    const encoded = await cryptoForTests.encode(notebook, 'correct horse battery staple')
    expect(encoded).not.toContain('Secret field notes')
    await expect(cryptoForTests.decode(encoded)).rejects.toThrow('PASSCODE_REQUIRED')
    await expect(cryptoForTests.decode(encoded, 'wrong')).rejects.toThrow('INVALID_PASSCODE')
    await expect(cryptoForTests.decode(encoded, 'correct horse battery staple')).resolves.toEqual(notebook)
  })

  it('serializes overlapping saves and leaves a verified recovery copy', async () => {
    process.env.LNB_TEST_DOCUMENTS = await mkdtemp(join(tmpdir(), 'lined-notebook-save-'))
    const { saveNotebook, loadNotebook } = await import('./storage')
    const first = createNotebook('First title', 20, RULING_HEIGHTS.college, '#ffffff')
    const second = { ...first, title: 'Second title', modifiedAt: new Date(Date.now() + 1000).toISOString() }
    const third = { ...second, title: 'Final title', modifiedAt: new Date(Date.now() + 2000).toISOString() }
    const paths = await Promise.all([saveNotebook(first), saveNotebook(second), saveNotebook(third)])
    await expect(loadNotebook(paths[2])).resolves.toMatchObject({ title: 'Final title' })
    expect(await readdir(join(process.env.LNB_TEST_DOCUMENTS, 'Lined Notebooks'))).toContain(`${first.id}.lnb.backup`)
    expect(await readFile(paths[2], 'utf8')).not.toHaveLength(0)
  })
})
