/* Adapted for dsh-codex-connect-plus from dsh-image2-draw and codex-gpt-image; Copyright 2026 0751; see THIRD_PARTY_NOTICES.md. */
/** Fixed Codex Images JSON protocol, validation, limits, and redacted failures. */

import type { OpenAICodexAuthRuntime } from '../auth-runtime.ts'

export const CODEX_IMAGE_MODEL = 'gpt-image-2'
export const CODEX_IMAGE_GENERATE_URL = 'https://chatgpt.com/backend-api/codex/images/generations'
export const CODEX_IMAGE_EDIT_URL = 'https://chatgpt.com/backend-api/codex/images/edits'
export const CODEX_IMAGE_TIMEOUT_MS = 10 * 60 * 1000
export const CODEX_IMAGE_MAX_RESPONSE_BYTES = 48 * 1024 * 1024
export const CODEX_IMAGE_MAX_ERROR_BYTES = 64 * 1024
export const CODEX_IMAGE_MAX_OUTPUT_BYTES = 32 * 1024 * 1024
export const CODEX_IMAGE_MAX_INPUT_BYTES = 4 * 1024 * 1024
export const CODEX_IMAGE_MAX_INPUTS = 8

const MIN_PIXELS = 655_360
const MAX_PIXELS = 8_294_400
const MAX_EDGE = 3840
const MAX_RATIO = 3

export type CodexImageQuality = 'low' | 'medium' | 'high' | 'auto'
export type CodexImageBackground = 'auto' | 'opaque'
export type CodexImageModeration = 'auto' | 'low'
export type CodexImageMediaType = 'image/png' | 'image/jpeg' | 'image/webp'
export type CodexImageMode = 'generate' | 'edit'

export interface CodexImageType {
  extension: '.png' | '.jpg' | '.webp'
  mediaType: CodexImageMediaType
}

export interface CodexImageRequest {
  prompt: string
  model: typeof CODEX_IMAGE_MODEL
  n: number
  size: string
  quality: CodexImageQuality
  output_format: 'png'
  background: CodexImageBackground
  moderation: CodexImageModeration
  images?: readonly { image_url: string }[]
  mask?: { image_url: string }
}

export interface DecodedCodexImage {
  data: Uint8Array
  type: CodexImageType
  revisedPrompt?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function adaptiveSize(prompt: string): string {
  const text = prompt.toLowerCase()
  if (['竖版', '竖屏', '纵向', '手机壁纸', 'portrait', 'vertical', '9:16', '2:3'].some(word => text.includes(word))) return '1024x1536'
  if (['横版', '横屏', '横幅', '封面', 'landscape', 'horizontal', '16:9', '3:2'].some(word => text.includes(word))) return '1536x1024'
  return '1024x1024'
}

/** Resolve aliases and enforce conservative dimensions accepted by the backend. */
export function resolveCodexImageSize(value: string | undefined, prompt: string): string {
  const aliases: Record<string, string> = {
    portrait: '1024x1536', vertical: '1024x1536',
    landscape: '1536x1024', horizontal: '1536x1024',
    square: '1024x1024',
  }
  let raw = (value ?? 'adaptive').trim().toLowerCase()
  if (raw === 'adaptive' || raw === 'auto') raw = adaptiveSize(prompt)
  raw = (aliases[raw] ?? raw).replaceAll('*', 'x')
  const match = /^(\d+)x(\d+)$/u.exec(raw)
  if (match === null) throw new Error('size must be adaptive, portrait, landscape, square, or WIDTHxHEIGHT')
  const width = Number(match[1])
  const height = Number(match[2])
  const pixels = width * height
  const ratio = Math.max(width, height) / Math.min(width, height)
  if (width % 16 !== 0 || height % 16 !== 0) throw new Error('image width and height must be multiples of 16')
  if (Math.max(width, height) > MAX_EDGE) throw new Error(`image longest edge must not exceed ${MAX_EDGE}`)
  if (pixels < MIN_PIXELS || pixels > MAX_PIXELS) throw new Error(`image pixels must be between ${MIN_PIXELS} and ${MAX_PIXELS}`)
  if (ratio > MAX_RATIO) throw new Error(`image aspect ratio must not exceed ${MAX_RATIO}:1`)
  return `${width}x${height}`
}

/** Recognize only supported raster signatures after decoding. */
export function detectCodexImageType(data: Uint8Array): CodexImageType {
  if (data.length >= 8
    && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47
    && data[4] === 0x0d && data[5] === 0x0a && data[6] === 0x1a && data[7] === 0x0a) {
    return { extension: '.png', mediaType: 'image/png' }
  }
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return { extension: '.jpg', mediaType: 'image/jpeg' }
  }
  if (data.length >= 12
    && String.fromCharCode(...data.subarray(0, 4)) === 'RIFF'
    && String.fromCharCode(...data.subarray(8, 12)) === 'WEBP') {
    return { extension: '.webp', mediaType: 'image/webp' }
  }
  throw new Error('Codex Images returned an unrecognized image payload')
}

/** Encode one already-validated local reference for the JSON edit request. */
export function imageDataUrl(data: Uint8Array, mediaType: CodexImageMediaType): string {
  return `data:${mediaType};base64,${Buffer.from(data).toString('base64')}`
}

function normalizedQuality(value: string | undefined): CodexImageQuality {
  if (value === undefined) return 'auto'
  if (value === 'low' || value === 'medium' || value === 'high' || value === 'auto') return value
  throw new Error('quality must be low, medium, high, or auto')
}

function normalizedBackground(value: string | undefined): CodexImageBackground {
  if (value === undefined) return 'auto'
  if (value === 'auto' || value === 'opaque') return value
  throw new Error('background must be auto or opaque')
}

function normalizedModeration(value: string | undefined): CodexImageModeration {
  if (value === undefined) return 'auto'
  if (value === 'auto' || value === 'low') return value
  throw new Error('moderation must be auto or low')
}

/** Validate common tool input and produce the fixed JSON request fields. */
export function createCodexImageRequest(input: {
  prompt: string
  size?: string
  quality?: string
  background?: string
  moderation?: string
  count?: number
  images?: readonly { image_url: string }[]
  mask?: { image_url: string }
}): CodexImageRequest {
  const prompt = input.prompt.trim()
  if (prompt.length === 0) throw new Error('prompt must not be empty')
  const count = input.count ?? 1
  if (!Number.isInteger(count) || count < 1 || count > 4) throw new Error('count must be an integer from 1 to 4')
  return {
    prompt,
    model: CODEX_IMAGE_MODEL,
    n: count,
    size: resolveCodexImageSize(input.size, prompt),
    quality: normalizedQuality(input.quality),
    output_format: 'png',
    background: normalizedBackground(input.background),
    moderation: normalizedModeration(input.moderation),
    ...input.images === undefined ? {} : { images: input.images },
    ...input.mask === undefined ? {} : { mask: input.mask },
  }
}

interface TimedSignal {
  signal: AbortSignal
  timedOut: () => boolean
  cleanup: () => void
}

function timedSignal(parent: AbortSignal | undefined, timeoutMs: number): TimedSignal {
  const controller = new AbortController()
  let didTimeOut = false
  const onAbort = (): void => { controller.abort(parent?.reason) }
  if (parent?.aborted === true) onAbort()
  else parent?.addEventListener('abort', onAbort, { once: true })
  const timer = setTimeout(() => {
    didTimeOut = true
    controller.abort(new Error('timeout'))
  }, timeoutMs)
  return {
    signal: controller.signal,
    timedOut: () => didTimeOut,
    cleanup: () => {
      clearTimeout(timer)
      parent?.removeEventListener('abort', onAbort)
    },
  }
}

async function readLimited(response: Response, maxBytes: number, label: string): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length') ?? '0')
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error(`${label} exceeds ${Math.ceil(maxBytes / 1024 / 1024)}MB`)
  if (response.body === null) return new Uint8Array()
  const chunks: Uint8Array[] = []
  let size = 0
  const reader = response.body.getReader()
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      size += next.value.byteLength
      if (size > maxBytes) {
        await reader.cancel()
        throw new Error(`${label} exceeds ${Math.ceil(maxBytes / 1024 / 1024)}MB`)
      }
      chunks.push(next.value)
    }
  } finally {
    reader.releaseLock()
  }
  const result = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }
  return result
}

/** Redact provider-controlled details before displaying an HTTP failure. */
export function safeCodexImageHttpError(status: number, body: Uint8Array): Error {
  if (status === 401 || status === 403) {
    return new Error('Codex Images authorization was rejected. Renew Codex Connect Plus sign-in and verify Image2 access.')
  }
  let detail = Buffer.from(body).toString('utf8').slice(0, 1000)
  try { detail = JSON.stringify(JSON.parse(detail)).slice(0, 1000) } catch {}
  detail = detail
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu, '[redacted token]')
    .replace(/("?(?:access|refresh|token|authorization)"?\s*[:=]\s*")([^"\s]+)/giu, '$1[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/giu, 'Bearer [redacted]')
    .replace(/data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/giu, '[redacted image data]')
  return new Error(`Codex Images request failed (HTTP ${status})${detail.length === 0 ? '' : `: ${detail}`}`)
}

function strictBase64(value: string): Uint8Array {
  if (value.length === 0 || value.length > Math.ceil(CODEX_IMAGE_MAX_OUTPUT_BYTES / 3) * 4) {
    throw new Error('Codex image payload exceeded the 32MB limit')
  }
  if (value.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)) {
    throw new Error('Codex Images returned invalid base64 image data')
  }
  const data = new Uint8Array(Buffer.from(value, 'base64'))
  if (data.byteLength > CODEX_IMAGE_MAX_OUTPUT_BYTES) throw new Error('Codex image payload exceeded the 32MB limit')
  return data
}

/** Parse and validate every image payload from a bounded JSON response. */
export function decodeCodexImageResponse(value: unknown): DecodedCodexImage[] {
  if (!isRecord(value) || !Array.isArray(value['data'])) throw new Error('Codex Images response has no data array')
  const images: DecodedCodexImage[] = []
  for (const item of value['data']) {
    if (!isRecord(item) || typeof item['b64_json'] !== 'string') continue
    const data = strictBase64(item['b64_json'])
    const type = detectCodexImageType(data)
    images.push({
      data,
      type,
      ...typeof item['revised_prompt'] === 'string' ? { revisedPrompt: item['revised_prompt'] } : {},
    })
  }
  if (images.length === 0) throw new Error('Codex Images returned no base64 image payload')
  return images
}

/** Execute one fixed-origin JSON request through the shared refreshed OAuth runtime. */
export async function requestCodexImages(options: {
  auth: OpenAICodexAuthRuntime
  mode: CodexImageMode
  body: CodexImageRequest
  signal?: AbortSignal
  fetch?: typeof fetch
}): Promise<DecodedCodexImage[]> {
  const { accessToken, accountId } = await options.auth.authorizedAccount()
  const timeout = timedSignal(options.signal, CODEX_IMAGE_TIMEOUT_MS)
  try {
    const response = await (options.fetch ?? fetch)(
      options.mode === 'edit' ? CODEX_IMAGE_EDIT_URL : CODEX_IMAGE_GENERATE_URL,
      {
        method: 'POST',
        redirect: 'error',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'chatgpt-account-id': accountId,
          accept: 'application/json',
          'content-type': 'application/json',
          originator: 'dsh-codex-connect-plus',
          'user-agent': 'dsh-codex-connect-plus/0.1.0',
        },
        body: JSON.stringify(options.body),
        signal: timeout.signal,
      },
    )
    if (!response.ok) {
      throw safeCodexImageHttpError(
        response.status,
        await readLimited(response, CODEX_IMAGE_MAX_ERROR_BYTES, 'Codex Images error response'),
      )
    }
    const payload = await readLimited(response, CODEX_IMAGE_MAX_RESPONSE_BYTES, 'Codex Images response')
    let parsed: unknown
    try { parsed = JSON.parse(Buffer.from(payload).toString('utf8')) } catch { throw new Error('Codex Images returned unreadable JSON') }
    return decodeCodexImageResponse(parsed)
  } catch (error: unknown) {
    if (options.signal?.aborted === true) throw new Error('Codex image generation was cancelled')
    if (timeout.timedOut()) throw new Error('Codex image generation timed out after 10 minutes; the upstream may still have processed the request')
    throw error
  } finally {
    timeout.cleanup()
  }
}
