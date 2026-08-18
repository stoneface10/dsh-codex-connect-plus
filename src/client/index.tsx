/* Modified from dsh-codex-connect by 0751 for dsh-codex-connect-plus; Copyright 2026 0751; Apache-2.0, see NOTICE. */
/** Browser half: OpenAI Codex account management inside Plugin configuration. */

import type { ClientContext, ISessions } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import {
  decodeOpenAICodexSettings,
  OPENAI_CODEX_SETTINGS_NAMESPACE,
} from '../settings-contract.ts'
import { OpenAICodexPluginCard } from './OpenAICodexPluginCard.tsx'
import { CodexImageToolView } from './CodexImageToolView.tsx'
import type { CodexImageToolViewInjected } from './CodexImageToolView.tsx'
import { createCodexImageLoader } from './image-loader.ts'
import { CODEX_IMAGE_EDIT_TOOL_NAME, CODEX_IMAGE_GENERATE_TOOL_NAME } from '../images/contract.ts'
import type { OpenAICodexPluginCardInjected } from './OpenAICodexPluginCard.tsx'
import { en, zh } from './locales.ts'
import type { OpenAICodexSettingsKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** OpenAI Codex account page copy. */
    'settings.openai-codex': OpenAICodexSettingsKey
  }
}

/** Stable browser-plugin name. */
export const name = 'dsh-codex-connect-plus-client'
/** Client services required by the Plugin configuration contribution. */
export const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope', 'sessions']

/** Register account copy and the OpenAI Codex card under Plugin configuration. */
export function apply(ctx: ClientContext): void {
  const namespace = 'settings.openai-codex'
  const sessions = ctx.get('sessions') as ISessions
  ctx.effect(() => ctx.locale.register(namespace, { zh, en }), 'dsh-codex-connect-plus: settings copy')
  const t = ctx.locale.bind(namespace) as OpenAICodexPluginCardInjected['t']
  const configScope = ctx.settingsScope.bind({
    namespace: OPENAI_CODEX_SETTINGS_NAMESPACE,
    decode: decodeOpenAICodexSettings,
  })
  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: 'openai-codex',
    priority: 30,
    inject: (): OpenAICodexPluginCardInjected => ({ t, configScope }),
  }, OpenAICodexPluginCard))
  for (const key of [CODEX_IMAGE_GENERATE_TOOL_NAME, CODEX_IMAGE_EDIT_TOOL_NAME]) {
    ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
      name: 'tool.call.toolview',
      key,
      inject: sessionId => ({
        loadImage: createCodexImageLoader(sessions, sessionId),
      } satisfies CodexImageToolViewInjected),
    }, CodexImageToolView))
  }
}
