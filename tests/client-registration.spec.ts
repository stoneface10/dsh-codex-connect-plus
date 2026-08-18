import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('OpenAI Codex browser contribution', () => {
  it('registers as a Plugin configuration card instead of adding a tab or section', async () => {
    const client = await readFile(new URL('../src/client/index.tsx', import.meta.url), 'utf8')
    expect(client).toContain("ctx.slots.inject('settings.plugin.item'")
    expect(client).toContain("name: 'settings.plugin.item'")
    expect(client).toContain('key: OPENAI_CODEX_SETTINGS_NAMESPACE')
    expect(client).toContain('priority: 30')
    expect(client).toContain('ctx.settingsScope.bind')
    expect(client).toContain('OPENAI_CODEX_SETTINGS_NAMESPACE')
    expect(client).not.toContain("ctx.slots.inject('settings.plugins.tab'")
    expect(client).not.toContain("ctx.slots.inject('settings.section'")
    expect(client).toContain("ctx.slots.inject('tool.call.toolview'")
    expect(client).toContain('createCodexImageLoader(sessions, sessionId)')
  })

  it('keeps the committed browser bundle free of Host-only runtime imports', async () => {
    const bundle = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
    const requires = [...bundle.matchAll(/require\("([^"]+)"\)/gu)].map(match => match[1])
    expect(requires).toEqual(['react', 'react/jsx-runtime'])
    expect(bundle).not.toContain('@deepseek-ai/dsh-attachment')
    expect(bundle).not.toContain('@deepseek-ai/dsh-tools')
    expect(bundle).not.toMatch(/node:(?:fs|path|http)/u)
  })

  it('renders a Codex Connect card and uses OpenAI Codex for the Composer provider', async () => {
    const [clientCard, locales, adapter] = await Promise.all([
      readFile(new URL('../src/client/OpenAICodexPluginCard.tsx', import.meta.url), 'utf8'),
      readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8'),
      readFile(new URL('../src/adapter.ts', import.meta.url), 'utf8'),
    ])
    expect(clientCard).toContain('<li style={cardStyle}>')
    expect(clientCard).toContain('aria-expanded={open}')
    expect(locales.match(/title: 'Codex Connect Plus'/gu)).toHaveLength(2)
    expect(adapter).toContain("displayName: 'OpenAI Codex'")
  })
})
