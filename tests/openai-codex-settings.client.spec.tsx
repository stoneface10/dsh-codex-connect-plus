// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import { OpenAICodexSettings } from '../src/client/OpenAICodexSettings.tsx'
import { en } from '../src/client/locales.ts'
import type { OpenAICodexSettingsKey } from '../src/client/locales.ts'
import { DEFAULT_OPENAI_CODEX_SETTINGS } from '../src/settings-contract.ts'
import type { OpenAICodexSettingsConfig } from '../src/settings-contract.ts'
import {
  OPENAI_CODEX_AUTH_LOGIN_PATH,
  OPENAI_CODEX_AUTH_LOGOUT_PATH,
  OPENAI_CODEX_AUTH_STATUS_PATH,
} from '../src/auth-paths.ts'

function t(key: OpenAICodexSettingsKey, params: Record<string, unknown> = {}): string {
  return Object.entries(params).reduce(
    (value, [name, replacement]) => value.replace(`{${name}}`, String(replacement)),
    en[key],
  )
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function requestPath(input: string | URL | Request): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.pathname : new URL(input.url).pathname
}

function popupFixture(): { popup: Window; close: ReturnType<typeof vi.fn>; replace: ReturnType<typeof vi.fn> } {
  const close = vi.fn()
  const replace = vi.fn()
  return {
    popup: { close, opener: window, location: { replace } } as unknown as Window,
    close,
    replace,
  }
}

function settingsScopeFixture(writable = true) {
  let snapshot: SettingsScopeSnapshot<OpenAICodexSettingsConfig> = {
    status: 'ready',
    value: { ...DEFAULT_OPENAI_CODEX_SETTINGS },
    base: { ...DEFAULT_OPENAI_CODEX_SETTINGS },
    user: undefined,
    revision: 0,
    writable,
    mode: 'host',
  }
  const saveConfig = vi.fn(async (
    desired: OpenAICodexSettingsConfig,
    expectedRevision?: number,
  ): Promise<SettingsScopeSnapshot<OpenAICodexSettingsConfig>> => {
    if (expectedRevision !== snapshot.revision) throw new Error('stale settings revision')
    snapshot = {
      ...snapshot,
      value: { ...desired },
      user: { ...desired },
      revision: (snapshot.revision ?? 0) + 1,
    }
    return snapshot
  })
  return { snapshot, saveConfig }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('OpenAI Codex Plugin configuration card', () => {
  it('reports a blocked popup without starting an orphaned login', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request): Promise<Response> => {
      expect(requestPath(input)).toBe(OPENAI_CODEX_AUTH_STATUS_PATH)
      return json({ status: 'signed-out' })
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(window, 'open').mockReturnValue(null)

    render(<OpenAICodexSettings t={t} embedded />)
    fireEvent.click(await screen.findByRole('button', { name: en.login }))

    expect(await screen.findByText(en.popupBlocked)).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('closes the popup and surfaces a failed login request', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request): Promise<Response> => {
      const path = requestPath(input)
      if (path === OPENAI_CODEX_AUTH_STATUS_PATH) return json({ status: 'signed-out' })
      expect(path).toBe(OPENAI_CODEX_AUTH_LOGIN_PATH)
      return json({ error: 'OAuth is unavailable' }, 503)
    })
    const { popup, close } = popupFixture()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(window, 'open').mockReturnValue(popup)

    render(<OpenAICodexSettings t={t} embedded />)
    fireEvent.click(await screen.findByRole('button', { name: en.login }))

    expect(await screen.findByText('OAuth is unavailable')).toBeTruthy()
    expect(close).toHaveBeenCalledOnce()
  })

  it('renders signed-in quota semantics and signs out', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request): Promise<Response> => {
      const path = requestPath(input)
      if (path === OPENAI_CODEX_AUTH_STATUS_PATH) {
        return json({
          status: 'signed-in',
          usage: {
            rateLimits: [{
              id: 'codex',
              name: 'Codex',
              windows: [{ remainingPercent: 72.5, windowSeconds: 18_000 }],
            }],
          },
        })
      }
      expect(path).toBe(OPENAI_CODEX_AUTH_LOGOUT_PATH)
      return json({ ok: true })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<OpenAICodexSettings t={t} embedded />)
    const progress = await screen.findByRole('progressbar', { name: en.fiveHourLimit })
    expect(progress.getAttribute('aria-valuenow')).toBe('72.5')
    expect(progress.getAttribute('aria-valuetext')).toBe('72.5% remaining')

    fireEvent.click(screen.getByRole('button', { name: en.logout }))
    expect(await screen.findByText(en.signedOut)).toBeTruthy()
  })

  it('disables account actions while a login request is pending', async () => {
    let resolveLogin: ((value: Response) => void) | undefined
    const fetchMock = vi.fn((input: string | URL | Request): Promise<Response> => {
      const path = requestPath(input)
      if (path === OPENAI_CODEX_AUTH_STATUS_PATH) return Promise.resolve(json({ status: 'signed-out' }))
      return new Promise(resolve => { resolveLogin = resolve })
    })
    const { popup, replace } = popupFixture()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(window, 'open').mockReturnValue(popup)

    render(<OpenAICodexSettings t={t} embedded />)
    fireEvent.click(await screen.findByRole('button', { name: en.login }))
    const working = await screen.findByRole('button', { name: en.working })
    expect((working as HTMLButtonElement).disabled).toBe(true)

    await act(async () => {
      resolveLogin?.(json({ url: 'https://auth.openai.com/authorize' }))
    })
    await waitFor(() => { expect(replace).toHaveBeenCalledWith('https://auth.openai.com/authorize') })
  })

  it('does not update state after unmount and aborts its status request', () => {
    let statusSignal: AbortSignal | undefined
    const fetchMock = vi.fn((_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      statusSignal = init?.signal instanceof AbortSignal ? init.signal : undefined
      return new Promise(() => {})
    })
    vi.stubGlobal('fetch', fetchMock)

    const rendered = render(<OpenAICodexSettings t={t} embedded />)
    rendered.unmount()

    expect(statusSignal?.aborted).toBe(true)
  })

  it('surfaces logout failure and keeps account actions accessible', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request): Promise<Response> => {
      const path = requestPath(input)
      if (path === OPENAI_CODEX_AUTH_STATUS_PATH) {
        return json({ status: 'signed-in', usage: { rateLimits: [] } })
      }
      expect(path).toBe(OPENAI_CODEX_AUTH_LOGOUT_PATH)
      return json({ error: 'Could not sign out' }, 500)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<OpenAICodexSettings t={t} embedded />)
    fireEvent.click(await screen.findByRole('button', { name: en.logout }))

    expect(await screen.findByText('Could not sign out')).toBeTruthy()
    expect((screen.getByRole('button', { name: en.loginAgain }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('stages, discards, and saves optional capability settings in the same card', async () => {
    const fetchMock = vi.fn(async (): Promise<Response> => json({ status: 'signed-out' }))
    const { snapshot, saveConfig } = settingsScopeFixture()
    vi.stubGlobal('fetch', fetchMock)

    render(<OpenAICodexSettings t={t} configSnapshot={snapshot} saveConfig={saveConfig} embedded />)
    const enableSearch = await screen.findByRole('checkbox', { name: /Enable Codex search provider/u }) as HTMLInputElement
    const model = screen.getByRole('textbox', { name: en.searchModel }) as HTMLInputElement
    expect(enableSearch.checked).toBe(false)
    expect(model.disabled).toBe(true)

    fireEvent.click(enableSearch)
    expect(model.disabled).toBe(false)
    fireEvent.change(model, { target: { value: 'temporary-model' } })
    fireEvent.click(screen.getByRole('button', { name: en.discard }))
    expect(enableSearch.checked).toBe(false)
    expect(model.value).toBe(DEFAULT_OPENAI_CODEX_SETTINGS.searchModel)

    fireEvent.click(enableSearch)
    fireEvent.change(screen.getByRole('combobox', { name: /^Automatic model retries/u }), { target: { value: '10' } })
    fireEvent.change(model, { target: { value: 'gpt-search-custom' } })
    fireEvent.change(screen.getByRole('combobox', { name: en.searchMode }), { target: { value: 'live' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: en.searchMaxOutputTokens }), { target: { value: '2048' } })
    fireEvent.click(screen.getByRole('button', { name: en.save }))

    expect(await screen.findByText(en.settingsSaved)).toBeTruthy()
    expect(saveConfig).toHaveBeenCalledWith({
      ...DEFAULT_OPENAI_CODEX_SETTINGS,
      modelMaxRetries: 10,
      enableSearch: true,
      searchModel: 'gpt-search-custom',
      searchMode: 'live',
      searchMaxOutputTokens: 2048,
    }, 0)
  })

  it('disables capability edits when the Host settings document is read-only', async () => {
    const fetchMock = vi.fn(async (): Promise<Response> => json({ status: 'signed-out' }))
    const { snapshot, saveConfig } = settingsScopeFixture(false)
    vi.stubGlobal('fetch', fetchMock)

    render(<OpenAICodexSettings t={t} configSnapshot={snapshot} saveConfig={saveConfig} embedded />)

    expect(await screen.findByText(en.settingsReadOnly)).toBeTruthy()
    expect(document.querySelector('fieldset')?.disabled).toBe(true)
    expect((screen.getByRole('button', { name: en.save }) as HTMLButtonElement).disabled).toBe(true)
  })
})
