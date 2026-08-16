import { afterEach, describe, expect, it, vi } from 'vitest'
import { run } from '../src/bin.ts'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('dsh-codex-connect-plus CLI', () => {
  it('documents doctor and uses the package executable name', async () => {
    let output = ''
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      output += String(chunk)
      return true
    })
    await expect(run(['--help'])).resolves.toBe(0)
    expect(output).toContain('Usage: dsh-codex-connect-plus <doctor|login|logout|status>')
    expect(output).toContain('doctor         inspect secret-free')
  })

  it('uses a consistent error prefix', async () => {
    let output = ''
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
      output += String(chunk)
      return true
    })
    await expect(run(['doctor', '--device-code'])).resolves.toBe(1)
    expect(output).toMatch(/^dsh-codex-connect-plus:/)
    expect(output).not.toContain('dsh-openai-codex:')
  })
})
