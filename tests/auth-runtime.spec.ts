import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { OAuthCredential } from '@earendil-works/pi-ai'
import { OpenAICodexAuthRuntime } from '../src/auth-runtime.ts'
import { OpenAICodexCredentialStore, OPENAI_CODEX_PROVIDER } from '../src/store.ts'

let root: string | undefined

afterEach(async () => {
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

describe('shared OpenAI Codex auth runtime', () => {
  it('returns provider-resolved access with the matching persisted account id', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-codex-connect-plus-auth-runtime-'))
    const store = new OpenAICodexCredentialStore(join(root, 'auth.json'))
    const credential: OAuthCredential = {
      type: 'oauth',
      access: 'current-access',
      refresh: 'stored-refresh',
      expires: Date.now() + 60_000,
      accountId: 'account-123',
    }
    await store.modify(OPENAI_CODEX_PROVIDER, () => Promise.resolve(credential))
    const runtime = new OpenAICodexAuthRuntime(store)
    expect(runtime.adapterAuth.credentials).toBe(store)
    await expect(runtime.accessToken()).resolves.toBe('current-access')
    await expect(runtime.authorizedAccount()).resolves.toEqual({
      accessToken: 'current-access',
      accountId: 'account-123',
    })
  })

  it('fails without leaking refresh state when signed out', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-codex-connect-plus-auth-runtime-'))
    const runtime = new OpenAICodexAuthRuntime(new OpenAICodexCredentialStore(join(root, 'missing.json')))
    const error = await runtime.authorizedAccount().catch((reason: unknown) => reason)
    expect(error).toBeInstanceOf(Error)
    expect(String(error)).toContain('signed out')
    expect(String(error)).not.toContain('refresh')
  })
})
