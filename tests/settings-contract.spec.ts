import { describe, expect, it } from 'vitest'
import {
  decodeOpenAICodexSettings,
  DEFAULT_OPENAI_CODEX_SETTINGS,
} from '../src/settings-contract.ts'

function settings(modelMaxRetries: number): Record<string, unknown> {
  return { ...DEFAULT_OPENAI_CODEX_SETTINGS, modelMaxRetries }
}

describe('OpenAI Codex settings contract', () => {
  it.each([0, 2, 3, 9, 10])('accepts %i bounded model retries', (modelMaxRetries) => {
    expect(decodeOpenAICodexSettings(settings(modelMaxRetries))?.modelMaxRetries).toBe(modelMaxRetries)
  })

  it('rejects a retry count above the bounded maximum', () => {
    expect(decodeOpenAICodexSettings(settings(11))).toBeUndefined()
  })
})
