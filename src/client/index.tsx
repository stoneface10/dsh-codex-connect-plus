/* Modified from dsh-codex-connect by 0751 for dsh-codex-connect-plus; Copyright 2026 0751; Apache-2.0, see NOTICE. */
/** Browser half: OpenAI Codex account management inside Plugin configuration. */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import {
  decodeOpenAICodexSettings,
  OPENAI_CODEX_SETTINGS_NAMESPACE,
} from '../settings-contract.ts'
import { OpenAICodexPluginCard } from './OpenAICodexPluginCard.tsx'
import type { OpenAICodexPluginCardInjected } from './OpenAICodexPluginCard.tsx'
import { CodexImageToolView } from './CodexImageToolView.tsx'
import type { CodexImageToolViewInjected } from './CodexImageToolView.tsx'
import { createCodexImageLoader } from './image-loader.ts'
import { CODEX_IMAGE_EDIT_TOOL_NAME, CODEX_IMAGE_GENERATE_TOOL_NAME } from '../images/contract.ts'
import { en, zh } from './locales.ts'
import type { OpenAICodexSettingsKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** OpenAI Codex account page copy. */
    'settings.openai-codex': OpenAICodexSettingsKey
  }
}

const SETTINGS_LOCALE = 'settings.openai-codex' as const

/** Stable browser-plugin name. */
export const name = 'dsh-codex-connect-plus-client'
/** Client services required by the Plugin configuration contribution. */
export const inject = ['slots', 'locale', 'settingsScope', 'sessions']

/** Register account copy and the OpenAI Codex card under Plugin configuration. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(SETTINGS_LOCALE, { zh, en }), 'dsh-codex-connect-plus: settings copy')
  const configScope = ctx.settingsScope.bind({
    namespace: OPENAI_CODEX_SETTINGS_NAMESPACE,
    decode: decodeOpenAICodexSettings,
  })
  const cardInjected = (): OpenAICodexPluginCardInjected => ({
    hooks: { openAICodexSettings: configScope },
    async saveConfig(desired, expectedRevision) {
      await configScope.mutate([
        { op: 'set', path: ['modelMaxRetries'], value: desired.modelMaxRetries },
        { op: 'set', path: ['enableSearch'], value: desired.enableSearch },
        { op: 'set', path: ['enableImageTool'], value: desired.enableImageTool },
        { op: 'set', path: ['enableImageGeneration'], value: desired.enableImageGeneration },
        { op: 'set', path: ['searchModel'], value: desired.searchModel },
        { op: 'set', path: ['searchMode'], value: desired.searchMode },
        { op: 'set', path: ['searchContextSize'], value: desired.searchContextSize },
        { op: 'set', path: ['searchMaxOutputTokens'], value: desired.searchMaxOutputTokens },
      ], expectedRevision)
      return configScope.getSnapshot()
    },
  })
  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: OPENAI_CODEX_SETTINGS_NAMESPACE,
    locale: SETTINGS_LOCALE,
    inject: cardInjected,
  }, OpenAICodexPluginCard))
  for (const key of [CODEX_IMAGE_GENERATE_TOOL_NAME, CODEX_IMAGE_EDIT_TOOL_NAME]) {
    ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
      name: 'tool.call.toolview',
      key,
      inject: sessionId => ({
        loadImage: createCodexImageLoader(ctx.sessions, sessionId),
      } satisfies CodexImageToolViewInjected),
    }, CodexImageToolView))
  }
}
