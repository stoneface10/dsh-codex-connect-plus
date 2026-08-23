import { describe, expect, it, vi } from 'vitest'
import { InMemoryCredentialStore } from '@earendil-works/pi-ai'
import { openaiCodexProvider } from '@earendil-works/pi-ai/providers/openai-codex'
import type { AttachmentStore, ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import {
  createOpenAICodexAdapter,
  createOpenAICodexProfile,
  OPENAI_CODEX_REQUEST_IMAGE_MAX_BYTES,
  OPENAI_CODEX_REQUEST_IMAGE_PIXEL_BUDGET,
} from '../src/adapter.ts'
import type { OpenAICodexAuthRuntime } from '../src/auth-runtime.ts'

const IMAGE_REF: ImageAttachmentRef = {
  attachmentId: `sha256:${'a'.repeat(64)}` as ImageAttachmentRef['attachmentId'],
  mediaType: 'image/png',
  bytes: 1,
  width: 1,
  height: 1,
}

function authDouble(): OpenAICodexAuthRuntime {
  return {
    provider: openaiCodexProvider(),
    adapterAuth: {
      credentials: new InMemoryCredentialStore(),
      authContext: {
        env: () => Promise.resolve(undefined),
        fileExists: () => Promise.resolve(false),
      },
    },
    accessToken: () => Promise.resolve('test-token'),
  } as unknown as OpenAICodexAuthRuntime
}

describe('OpenAI Codex adapter', () => {
  it('builds a complete current-DSH image request profile', () => {
    const profile = createOpenAICodexProfile(openaiCodexProvider(), 0)

    expect(profile).toMatchObject({
      maxRequestImageBytes: 20 * 1024 * 1024,
      requestImagePixelBudget: 2048 * 2048,
      requestImageMaxBytes: 1024 * 1024,
    })
  })

  it('supplies current DSH image preprocessing budgets before provider dispatch', async () => {
    const stop = new Error('stop after image policy capture')
    const readImageRequest = vi.fn(async () => Promise.reject(stop))
    const attachments = { readImageRequest } as unknown as AttachmentStore
    const adapter = createOpenAICodexAdapter(authDouble(), () => attachments)

    const consume = async (): Promise<void> => {
      for await (const _chunk of adapter.stream({
        provider: 'openai-codex',
        model: 'gpt-5.6-sol',
        messages: [createUserMessage({
          content: [{ type: 'image', attachment: IMAGE_REF }],
          source: { kind: 'plugin', plugin: 'test' },
        })],
      })) {}
    }

    await expect(consume()).rejects.toBe(stop)
    expect(readImageRequest).toHaveBeenCalledWith(IMAGE_REF, {
      maxPixels: OPENAI_CODEX_REQUEST_IMAGE_PIXEL_BUDGET,
      maxBytes: OPENAI_CODEX_REQUEST_IMAGE_MAX_BYTES,
    }, expect.any(AbortSignal))
  })
})
