/* dsh-codex-connect-plus original modifications; Copyright 2026 0751; Apache-2.0, see NOTICE. */
/** Shared provider-native OAuth runtime for models and optional Codex capabilities. */

import { createModels, defaultProviderAuthContext } from '@earendil-works/pi-ai'
import type { AuthContext, MutableModels, Provider } from '@earendil-works/pi-ai'
import { openaiCodexProvider } from '@earendil-works/pi-ai/providers/openai-codex'
import type { OpenAICodexCredentialStore } from './store.ts'
import { OPENAI_CODEX_PROVIDER } from './store.ts'

/** Refreshed authorization material required by fixed Codex application endpoints. */
export interface OpenAICodexAuthorizedAccount {
  accessToken: string
  accountId: string
}

/**
 * Own one pi-ai provider instance and its locked OAuth refresh lifecycle.
 * Callers never parse the credential file or invoke a token endpoint directly.
 */
export class OpenAICodexAuthRuntime {
  readonly provider: Provider
  /** Durable credential store and ambient auth context shared with every Codex adapter collection. */
  readonly adapterAuth: { credentials: OpenAICodexCredentialStore; authContext: AuthContext }
  private readonly models: MutableModels

  constructor(private readonly credentials: OpenAICodexCredentialStore) {
    this.provider = openaiCodexProvider()
    this.adapterAuth = { credentials, authContext: defaultProviderAuthContext() }
    this.models = createModels(this.adapterAuth)
    this.models.setProvider(this.provider)
  }

  /** Resolve a refreshed bearer token for the standard Codex model adapter. */
  async accessToken(): Promise<string | undefined> {
    return (await this.models.getAuth(OPENAI_CODEX_PROVIDER))?.auth.apiKey
  }

  /** Resolve a refreshed bearer and its account id without exposing stored refresh state. */
  async authorizedAccount(): Promise<OpenAICodexAuthorizedAccount> {
    const accessToken = await this.accessToken()
    const credential = await this.credentials.read(OPENAI_CODEX_PROVIDER)
    const accountId = credential?.type === 'oauth' ? credential.accountId : undefined
    if (typeof accessToken !== 'string' || accessToken.length === 0
      || typeof accountId !== 'string' || accountId.length === 0) {
      throw new Error('Codex Connect Plus is signed out. Sign in under Settings → Plugins → Codex Connect Plus.')
    }
    return { accessToken, accountId }
  }
}
