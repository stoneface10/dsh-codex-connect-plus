/* Modified from dsh-codex-connect by 0751 for dsh-codex-connect-plus; Copyright 2026 0751; Apache-2.0, see NOTICE. */
/** OpenAI Codex adapter assembled from public dsh-llm-pi-ai extension points. */

import type { Provider } from '@earendil-works/pi-ai'
import { resolveImageAttachmentAccess, resolveRetryPolicy } from '@deepseek-ai/dsh-llm'
import { PiAiAdapter } from '@deepseek-ai/dsh-llm-pi-ai'
import type { ResolvedPiAiProviderProfile } from '@deepseek-ai/dsh-llm-pi-ai'
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment'
import type { OpenAICodexAuthRuntime } from './auth-runtime.ts'
import { OPENAI_CODEX_PROVIDER } from './store.ts'

/** Provider idle ceiling used by the composite route. */
export const OPENAI_CODEX_STREAM_IDLE_TIMEOUT_MS = 300_000
/** Aggregate base64 image-payload ceiling for one model request. */
export const OPENAI_CODEX_MAX_REQUEST_IMAGE_BYTES = 20 * 1024 * 1024
/** Total pixels retained in each deterministic inline request image. */
export const OPENAI_CODEX_REQUEST_IMAGE_PIXEL_BUDGET = 2048 * 2048
/** Encoded-byte ceiling for each deterministic inline request image. */
export const OPENAI_CODEX_REQUEST_IMAGE_MAX_BYTES = 1024 * 1024
/** Initial delay for subscription-backed model request recovery. */
export const OPENAI_CODEX_RETRY_INITIAL_DELAY_MS = 1_000
/** Maximum delay between subscription-backed model request attempts. */
export const OPENAI_CODEX_RETRY_MAX_DELAY_MS = 30_000
/** Symmetric jitter applied to subscription-backed model retry delays. */
export const OPENAI_CODEX_RETRY_JITTER_RATIO = 0.2
/**
 * Retryable failures for the Codex route. PI_AI_ERROR is a bounded compatibility
 * fallback while pi-ai discards structured transient WebSocket and overload codes.
 */
export const OPENAI_CODEX_RETRYABLE_CODES = Object.freeze([
  'EMPTY_RESPONSE',
  'RATE_LIMIT',
  'SERVER',
  'TIMEOUT',
  'TRANSPORT',
  'PI_AI_ERROR',
])

/**
 * Give the generic dsh adapter a request-scoped bearer-token entry without
 * changing the provider's user-facing OAuth flow. The resolver accepts only
 * the explicit override supplied by this plugin; it never discovers an API
 * key from the environment or persistent api-key credentials.
 */
function requestProvider(provider: Provider): Provider {
  return {
    ...provider,
    auth: {
      ...provider.auth,
      apiKey: {
        name: 'OpenAI Codex OAuth bearer token',
        async resolve({ credential }) {
          const apiKey = credential?.key
          return apiKey === undefined || apiKey.length === 0
            ? undefined
            : { auth: { apiKey }, source: 'OAuth' }
        },
      },
    },
  }
}

/** Build the complete current-DSH profile used by one Codex adapter generation. */
export function createOpenAICodexProfile(provider: Provider, maxRetries: number): ResolvedPiAiProviderProfile {
  return {
    provider: OPENAI_CODEX_PROVIDER,
    displayName: 'OpenAI Codex',
    streamIdleTimeoutMs: OPENAI_CODEX_STREAM_IDLE_TIMEOUT_MS,
    maxRequestImageBytes: OPENAI_CODEX_MAX_REQUEST_IMAGE_BYTES,
    requestImagePixelBudget: OPENAI_CODEX_REQUEST_IMAGE_PIXEL_BUDGET,
    requestImageMaxBytes: OPENAI_CODEX_REQUEST_IMAGE_MAX_BYTES,
    retryPolicy: resolveRetryPolicy(
      {
        mode: 'normal',
        maxRetries,
        retryableCodes: [...OPENAI_CODEX_RETRYABLE_CODES],
        backoff: {
          initialDelayMs: OPENAI_CODEX_RETRY_INITIAL_DELAY_MS,
          maxDelayMs: OPENAI_CODEX_RETRY_MAX_DELAY_MS,
          jitterRatio: OPENAI_CODEX_RETRY_JITTER_RATIO,
        },
      },
      'dsh-codex-connect-plus retryPolicy',
    ),
    configuredMaxTokens: new Map(),
    piProvider: requestProvider(provider),
  }
}

/**
 * Create the Codex subscription adapter without requiring a dsh fork. The
 * public pi-ai adapter owns Harness message conversion, image attachment
 * resolution, streaming, reasoning metadata, and compaction behavior; this
 * plugin supplies its provider-native OAuth token for each request.
 */
export function createOpenAICodexAdapter(
  auth: OpenAICodexAuthRuntime,
  resolveAttachments: () => AttachmentStore | undefined,
  resolveModelMaxRetries: () => number = () => 0,
  resolveProcessPath: (hostPath: string) => string | undefined = () => undefined,
): PiAiAdapter {
  const provider = auth.provider
  let cachedMaxRetries: number | undefined
  let cachedProfiles: ReadonlyMap<string, ResolvedPiAiProviderProfile> | undefined
  const profiles = (): ReadonlyMap<string, ResolvedPiAiProviderProfile> => {
    const maxRetries = resolveModelMaxRetries()
    if (cachedProfiles !== undefined && cachedMaxRetries === maxRetries) return cachedProfiles
    cachedMaxRetries = maxRetries
    cachedProfiles = new Map<string, ResolvedPiAiProviderProfile>([[
      OPENAI_CODEX_PROVIDER,
      createOpenAICodexProfile(provider, maxRetries),
    ]])
    return cachedProfiles
  }
  return new PiAiAdapter({
    profiles,
    resolveApiKey: () => auth.accessToken(),
    auth: auth.adapterAuth,
    resolveAttachments,
    resolveImageAccess: (attachments, ref) =>
      resolveImageAttachmentAccess(attachments, resolveProcessPath, ref),
  })
}
