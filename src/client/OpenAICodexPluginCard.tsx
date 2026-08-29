/** OpenAI Codex account card contributed to Harness Plugin configuration. */

import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type { OpenAICodexSettingsConfig } from '../settings-contract.ts'
import { OpenAICodexSettings } from './OpenAICodexSettings.tsx'
import type { SaveOpenAICodexSettings } from './OpenAICodexConfiguration.tsx'

/** Dependencies injected by the browser-plugin registration. */
export interface OpenAICodexPluginCardInjected {
  hooks: {
    /** Host settings section bound by the Slot renderer as useOpenAICodexSettings. */
    openAICodexSettings: SettingsScope<OpenAICodexSettingsConfig>
  }
  /** Atomically save one staged configuration and return the Host-accepted view. */
  saveConfig: SaveOpenAICodexSettings
}

/** Props delivered by the Plugin configuration item slot. */
export type OpenAICodexPluginCardProps =
  PropsRuntime<'settings.plugin.item'>
  & PropsLocale<'settings.openai-codex'>
  & InjectFace<OpenAICodexPluginCardInjected>

const cardStyle: CSSProperties = {
  overflow: 'hidden',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 10,
  background: 'var(--dsw-alias-bg-module-platform)',
}
const headerStyle: CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  border: 0,
  padding: '13px 14px',
  background: 'transparent',
  color: 'var(--dsw-alias-label-primary)',
  font: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
}
const headTextStyle: CSSProperties = { display: 'flex', minWidth: 0, flexDirection: 'column', gap: 3 }
const nameStyle: CSSProperties = { fontSize: 14, lineHeight: '20px', fontWeight: 600 }
const descriptionStyle: CSSProperties = { fontSize: 13, lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)' }
const chevronStyle: CSSProperties = { flex: '0 0 auto', fontSize: 18, lineHeight: 1, transition: 'transform 120ms ease' }
const cardBodyStyle: CSSProperties = { borderTop: '1px solid var(--dsw-alias-border-l2)', padding: '16px 14px 18px' }

/** Render account management as one expandable Plugin configuration card. */
export function OpenAICodexPluginCard({ t, useOpenAICodexSettings, saveConfig }: OpenAICodexPluginCardProps) {
  const configSnapshot: SettingsScopeSnapshot<OpenAICodexSettingsConfig> = useOpenAICodexSettings(snapshot => snapshot)
  const [open, setOpen] = useState(false)
  const title = t('title')
  return (
    <li style={cardStyle}>
      <button
        type="button"
        style={headerStyle}
        aria-expanded={open}
        aria-label={`${t(open ? 'collapse' : 'expand')}: ${title}`}
        onClick={() => { setOpen(!open) }}
      >
        <span style={headTextStyle}>
          <span style={nameStyle}>{title}</span>
          <span style={descriptionStyle}>{t('intro')}</span>
        </span>
        <span aria-hidden="true" style={{ ...chevronStyle, transform: open ? 'rotate(180deg)' : 'none' }}>⌄</span>
      </button>
      {open
        ? <div style={cardBodyStyle}>
            <OpenAICodexSettings
              t={t}
              embedded
              configSnapshot={configSnapshot}
              saveConfig={saveConfig}
            />
          </div>
        : null}
    </li>
  )
}
