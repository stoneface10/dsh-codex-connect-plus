import { describe, expect, it, vi } from 'vitest'
import type { OpenAICodexAuthRuntime } from '../src/auth-runtime.ts'
import {
  CODEX_IMAGE_GENERATE_URL,
  createCodexImageRequest,
  decodeCodexImageResponse,
  detectCodexImageType,
  requestCodexImages,
  resolveCodexImageSize,
  safeCodexImageHttpError,
} from '../src/images/protocol.ts'

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
const auth = {
  authorizedAccount: vi.fn(async () => ({ accessToken: 'secret-access-token', accountId: 'acct-123' })),
} as unknown as OpenAICodexAuthRuntime

describe('Codex Images protocol', () => {
  it('resolves aliases and enforces conservative dimensions', () => {
    expect(resolveCodexImageSize('portrait', '')).toBe('1024x1536')
    expect(resolveCodexImageSize('adaptive', '竖版旅游海报')).toBe('1024x1536')
    expect(resolveCodexImageSize('landscape', '')).toBe('1536x1024')
    expect(resolveCodexImageSize('square', '')).toBe('1024x1024')
    expect(() => resolveCodexImageSize('1000x1000', '')).toThrow(/multiples of 16/u)
    expect(() => resolveCodexImageSize('4096x1024', '')).toThrow(/longest edge/u)
    expect(() => resolveCodexImageSize('3072x512', '')).toThrow(/aspect ratio/u)
  })

  it('validates common request values', () => {
    expect(createCodexImageRequest({ prompt: 'test', count: 1 })).toMatchObject({
      model: 'gpt-image-2', n: 1, size: '1024x1024', output_format: 'png', quality: 'auto',
    })
    expect(() => createCodexImageRequest({ prompt: ' ' })).toThrow(/prompt/u)
    expect(() => createCodexImageRequest({ prompt: 'x'.repeat(32_001) })).toThrow(/32000/u)
    expect(() => createCodexImageRequest({ prompt: 'test', count: 5 })).toThrow(/1 to 4/u)
    expect(() => createCodexImageRequest({ prompt: 'test', quality: 'ultra' })).toThrow(/quality/u)
    expect(() => createCodexImageRequest({ prompt: 'test', background: 'transparent' })).toThrow(/background/u)
  })

  it('validates decoded base64 and image signatures', () => {
    expect(detectCodexImageType(png)).toEqual({ extension: '.png', mediaType: 'image/png' })
    const decoded = decodeCodexImageResponse({ data: [{ b64_json: Buffer.from(png).toString('base64'), revised_prompt: 'better' }] })
    expect(decoded).toHaveLength(1)
    expect(decoded[0]?.revisedPrompt).toBe('better')
    expect(() => decodeCodexImageResponse({ data: [{ b64_json: 'not base64' }] })).toThrow(/base64/u)
    expect(() => decodeCodexImageResponse({ data: [{ b64_json: Buffer.from('text').toString('base64') }] })).toThrow(/unrecognized/u)
    expect(() => decodeCodexImageResponse({ data: Array.from({ length: 5 }, () => ({ b64_json: Buffer.from(png).toString('base64') })) })).toThrow(/more than 4/u)
  })

  it('uses the fixed endpoint, refreshed auth, JSON body, and no redirects', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe(CODEX_IMAGE_GENERATE_URL)
      expect(init?.redirect).toBe('error')
      const headers = new Headers(init?.headers)
      expect(headers.get('authorization')).toBe('Bearer secret-access-token')
      expect(headers.get('chatgpt-account-id')).toBe('acct-123')
      expect(headers.get('content-type')).toBe('application/json')
      expect(headers.get('user-agent')).toBe('dsh-codex-connect-plus/0.1.0-beta.6')
      expect(String(init?.body)).not.toContain('refresh')
      return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from(png).toString('base64') }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    const result = await requestCodexImages({
      auth,
      mode: 'generate',
      body: createCodexImageRequest({ prompt: 'test' }),
      fetch: fetchMock as typeof fetch,
    })
    expect(result).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('redacts provider-controlled secrets and does not retry failures', async () => {
    const message = safeCodexImageHttpError(500, Buffer.from('{"access_token":"abc","refresh_token":"def","b64_json":"QUJDRA==","error":"Bearer xyz","image":"data:image/png;base64,AAAA"}')).message
    expect(message).not.toContain('abc')
    expect(message).not.toContain('def')
    expect(message).not.toContain('QUJDRA==')
    expect(message).not.toContain('Bearer xyz')
    expect(message).not.toContain('base64,AAAA')
    const fetchMock = vi.fn(async () => new Response('{"error":"failed"}', { status: 500 }))
    await expect(requestCodexImages({
      auth,
      mode: 'generate',
      body: createCodexImageRequest({ prompt: 'test' }),
      fetch: fetchMock as typeof fetch,
    })).rejects.toThrow(/HTTP 500/u)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects an oversized response before JSON parsing', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', {
      status: 200,
      headers: { 'content-length': String(49 * 1024 * 1024) },
    }))
    await expect(requestCodexImages({
      auth,
      mode: 'generate',
      body: createCodexImageRequest({ prompt: 'test' }),
      fetch: fetchMock as typeof fetch,
    })).rejects.toThrow(/exceeds 48MB/u)
  })
})
