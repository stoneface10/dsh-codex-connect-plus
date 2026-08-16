import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  assertNoOpenAICodexProviderConflict,
  diagnoseOpenAICodex,
} from '../src/doctor.ts'

let root: string | undefined

afterEach(async () => {
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

describe('Codex Connect Plus doctor', () => {
  it('reports defaults and a missing credential without starting OAuth', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-codex-connect-doctor-'))
    const report = await diagnoseOpenAICodex({ credentialPath: join(root, 'missing.json') })
    expect(report.credentialFile.state).toBe('missing')
    expect(report.capabilities).toEqual({
      modelProvider: true,
      search: false,
      imageTool: false,
      imageGeneration: true,
      changesHarnessDefaultModel: false,
      changesHarnessSearchRoute: false,
    })
  })

  it('uses metadata only and never returns credential content', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-codex-connect-doctor-'))
    const filename = join(root, 'auth.json')
    const secret = 'access-token-must-not-leak'
    await writeFile(filename, secret, { mode: 0o600 })
    if (process.platform !== 'win32') await chmod(filename, 0o644)
    const report = await diagnoseOpenAICodex({ credentialPath: filename })
    expect(JSON.stringify(report)).not.toContain(secret)
    expect(report.credentialFile.state).toBe(process.platform === 'win32' ? 'owner-only' : 'permissions-too-broad')
  })

  it('gives a focused migration hint for a provider collision', async () => {
    const failure = () => assertNoOpenAICodexProviderConflict(['deepseek-official', 'openai-codex'])
    expect(failure).toThrow(/legacy dsh-codex bundle or manual openai-codex provider row/)
    await expect(diagnoseOpenAICodex({ providerIds: ['openai-codex'] }))
      .resolves.toMatchObject({ providerConflict: true })
  })
})
