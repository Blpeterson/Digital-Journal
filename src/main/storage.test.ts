import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createNotebook, RULING_HEIGHTS } from '../../packages/schema'

vi.mock('electron', () => ({ app: { getPath: () => 'unused' } }))

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
})
