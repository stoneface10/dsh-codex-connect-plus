/* Modified from dsh-codex-connect by 0751 for dsh-codex-connect-plus; Copyright 2026 0751; Apache-2.0, see NOTICE. */
/** Same-origin Web settings routes for OpenAI Codex OAuth. */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AuthEvent, AuthPrompt } from '@earendil-works/pi-ai'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { loginOpenAICodex, logoutOpenAICodex, openAICodexAuthStatus } from './auth.ts'
import type { OpenAICodexCredentialStore } from './store.ts'
import { readOpenAICodexRateLimits } from './usage.ts'
import type { OpenAICodexUsage } from './usage.ts'
import {
  OPENAI_CODEX_AUTH_LOGIN_PATH,
  OPENAI_CODEX_AUTH_LOGOUT_PATH,
  OPENAI_CODEX_AUTH_STATUS_PATH,
} from './auth-paths.ts'

export {
  OPENAI_CODEX_AUTH_LOGIN_PATH,
  OPENAI_CODEX_AUTH_LOGOUT_PATH,
  OPENAI_CODEX_AUTH_STATUS_PATH,
} from './auth-paths.ts'

/** Maximum time a browser request waits for the provider's authorization URL. */
export const OPENAI_CODEX_AUTH_URL_TIMEOUT_MS = 30_000

export type OpenAICodexWebAuthStatus =
  | { status: 'signed-out' }
  | { status: 'signing-in' }
  | { status: 'signed-in'; usage: OpenAICodexUsage; quotaError?: string }
  | { status: 'error'; message: string }

interface LoginChallenge {
  url: string
}

/** Testable timing boundary; production uses the exported 30-second ceiling. */
export interface OpenAICodexWebAuthOptions {
  challengeTimeoutMs?: number
}

/** Redact provider diagnostics before they cross to the browser. */
function safeMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu, '[redacted token]')
    .replace(/(\b(?:code|token|refresh_token|access_token)=)[^&\s]+/giu, '$1[redacted]')
    .slice(0, 1000)
}

/** Reject with the prompt's abort reason while browser callback owns completion. */
function waitForPromptAbort(prompt: AuthPrompt): Promise<string> {
  const signal = prompt.signal
  if (signal === undefined) return new Promise<string>(() => {})
  if (signal.aborted) return Promise.reject(signal.reason)
  return new Promise<string>((_resolve, reject) => {
    signal.addEventListener('abort', () => { reject(signal.reason) }, { once: true })
  })
}

/** One lifecycle owner for the callback server, challenge, and public status. */
export class OpenAICodexWebAuth {
  private state: OpenAICodexWebAuthStatus = { status: 'signed-out' }
  private operation: Promise<void> | undefined
  private cancellation: AbortController | undefined
  private challenge: LoginChallenge | undefined
  private challengeWaiters: Array<{ resolve(value: LoginChallenge): void; reject(error: unknown): void }> = []
  private challengeTimer: ReturnType<typeof setTimeout> | undefined
  private readonly challengeTimeoutMs: number

  constructor(
    private readonly store: OpenAICodexCredentialStore,
    options: OpenAICodexWebAuthOptions = {},
  ) {
    this.challengeTimeoutMs = options.challengeTimeoutMs ?? OPENAI_CODEX_AUTH_URL_TIMEOUT_MS
    if (!Number.isFinite(this.challengeTimeoutMs) || this.challengeTimeoutMs <= 0) {
      throw new TypeError('OpenAI Codex auth URL timeout must be a positive finite number')
    }
  }

  /** Read current public state, consulting durable storage while idle. */
  async status(): Promise<OpenAICodexWebAuthStatus> {
    if (this.operation !== undefined) return this.state
    if (this.state.status === 'error') return this.state
    return this.readStoredStatus()
  }

  /** Start or join the current browser-login operation. */
  async signIn(): Promise<LoginChallenge> {
    if (this.operation === undefined) this.start()
    if (this.challenge !== undefined) return this.challenge
    return new Promise<LoginChallenge>((resolve, reject) => {
      this.challengeWaiters.push({ resolve, reject })
    })
  }

  /** Cancel any callback listener, wait for quiescence, then delete the credential. */
  async signOut(): Promise<void> {
    this.cancelSignIn(new Error('OpenAI Codex sign-in cancelled'))
    await this.operation?.catch(() => undefined)
    await logoutOpenAICodex(this.store)
    this.challenge = undefined
    this.state = { status: 'signed-out' }
  }

  /** Stop the owned callback listener during plugin disposal. */
  async dispose(): Promise<void> {
    this.cancelSignIn(new Error('OpenAI Codex plugin disposed'))
    await this.operation?.catch(() => undefined)
  }

  private start(): void {
    const cancellation = new AbortController()
    this.cancellation = cancellation
    this.challenge = undefined
    this.state = { status: 'signing-in' }
    this.challengeTimer = setTimeout(() => {
      this.cancelSignIn(new Error(`OpenAI Codex did not provide an authorization URL within ${String(this.challengeTimeoutMs)}ms`))
    }, this.challengeTimeoutMs)
    this.challengeTimer.unref()
    this.operation = loginOpenAICodex({
      signal: cancellation.signal,
      prompt: prompt => prompt.type === 'select'
        ? Promise.resolve('browser')
        : waitForPromptAbort(prompt),
      notify: event => { this.onEvent(event) },
    }, this.store).then(
      async () => {
        if (this.challenge === undefined) {
          const error = new Error('OpenAI Codex sign-in finished without an authorization URL')
          this.rejectChallenge(error)
          this.state = { status: 'error', message: safeMessage(error) }
          return
        }
        this.state = await this.readStoredStatus()
      },
      (error: unknown) => {
        this.rejectChallenge(error)
        this.state = { status: 'error', message: safeMessage(error) }
      },
    ).finally(() => {
      this.clearChallengeTimer()
      this.operation = undefined
      this.cancellation = undefined
    })
  }

  private onEvent(event: AuthEvent): void {
    if (event.type !== 'auth_url') return
    let url: URL
    try {
      url = new URL(event.url)
    } catch {
      const error = new Error('OpenAI returned an invalid authorization URL')
      this.cancelSignIn(error)
      return
    }
    if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') {
      const error = new Error('OpenAI returned an unsafe authorization URL')
      this.cancelSignIn(error)
      return
    }
    const challenge = { url: event.url }
    this.challenge = challenge
    this.clearChallengeTimer()
    for (const waiter of this.challengeWaiters.splice(0)) waiter.resolve(challenge)
  }

  private async readStoredStatus(): Promise<OpenAICodexWebAuthStatus> {
    const stored = await openAICodexAuthStatus(this.store)
    if (!stored.authenticated) return { status: 'signed-out' }
    try {
      return { status: 'signed-in', usage: await readOpenAICodexRateLimits(this.store) }
    } catch (error: unknown) {
      return { status: 'signed-in', usage: { rateLimits: [] }, quotaError: safeMessage(error) }
    }
  }

  private rejectChallenge(error: unknown): void {
    this.clearChallengeTimer()
    for (const waiter of this.challengeWaiters.splice(0)) waiter.reject(error)
  }

  private clearChallengeTimer(): void {
    if (this.challengeTimer === undefined) return
    clearTimeout(this.challengeTimer)
    this.challengeTimer = undefined
  }

  private cancelSignIn(error: Error): void {
    this.rejectChallenge(error)
    this.cancellation?.abort(error)
  }
}

function loopbackHost(rawHost: string): boolean {
  if (/[\\/@?#]/u.test(rawHost)) return false
  try {
    const parsed = new URL(`http://${rawHost}`)
    if (parsed.username !== '' || parsed.password !== '' || parsed.pathname !== '/' || parsed.search !== '' || parsed.hash !== '') return false
    const bracketless = parsed.hostname.startsWith('[') && parsed.hostname.endsWith(']')
      ? parsed.hostname.slice(1, -1)
      : parsed.hostname
    const hostname = bracketless.toLowerCase().replace(/\.$/u, '')
    return hostname === 'localhost'
      || hostname.endsWith('.localhost')
      || hostname === '127.0.0.1'
      || hostname === '::1'
      || hostname === '::ffff:127.0.0.1'
  } catch {
    return false
  }
}

function exactOrigin(req: IncomingMessage, rawHost: string, rawOrigin: string): boolean {
  try {
    const origin = new URL(rawOrigin)
    if (origin.username !== '' || origin.password !== '' || origin.pathname !== '/' || origin.search !== '' || origin.hash !== '') return false
    const encrypted = (req.socket as IncomingMessage['socket'] & { encrypted?: boolean }).encrypted === true
    return origin.origin === new URL(`${encrypted ? 'https' : 'http'}://${rawHost}`).origin
  } catch {
    return false
  }
}

/** Whether a request comes from this loopback page rather than a remote/rebinding site. */
export function trustedRequest(req: IncomingMessage): boolean {
  const remote = req.socket.remoteAddress
  if (remote !== '127.0.0.1' && remote !== '::1' && remote !== '::ffff:127.0.0.1') return false
  if (req.headers['sec-fetch-site'] === 'cross-site') return false
  const host = req.headers.host
  if (typeof host !== 'string' || !loopbackHost(host)) return false
  const origin = req.headers.origin
  if (origin === undefined) return true
  return typeof origin === 'string' && exactOrigin(req, host, origin)
}

function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  res.end(JSON.stringify(value))
}

/** Register the plugin-owned OAuth routes when the Web server is composed. */
export function registerOpenAICodexAuthRoutes(
  ctx: Context,
  store: OpenAICodexCredentialStore,
): void {
  const auth = new OpenAICodexWebAuth(store)
  ctx.effect(() => {
    const routes = [
      ctx.webServer.register({
        kind: 'exact',
        path: OPENAI_CODEX_AUTH_STATUS_PATH,
        handler: async (req, res) => {
          if (req.method !== 'GET') return json(res, 405, { error: 'method not allowed' })
          if (!trustedRequest(req)) return json(res, 403, { error: 'forbidden' })
          json(res, 200, await auth.status())
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: OPENAI_CODEX_AUTH_LOGIN_PATH,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' })
          if (!trustedRequest(req)) return json(res, 403, { error: 'forbidden' })
          try {
            json(res, 200, await auth.signIn())
          } catch (error: unknown) {
            json(res, 500, { error: safeMessage(error) })
          }
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: OPENAI_CODEX_AUTH_LOGOUT_PATH,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' })
          if (!trustedRequest(req)) return json(res, 403, { error: 'forbidden' })
          try {
            await auth.signOut()
            json(res, 200, { ok: true })
          } catch (error: unknown) {
            json(res, 500, { error: safeMessage(error) })
          }
        },
      }),
    ]
    return async () => {
      for (const dispose of routes) dispose()
      await auth.dispose()
    }
  }, 'dsh-codex-connect-plus: Web OAuth routes')
}
