/* Modified from dsh-codex-connect by 0751 for dsh-codex-connect-plus; Copyright 2026 0751; Apache-2.0, see NOTICE. */
/**
 * Package-owned invariant companion for `dsh-codex-connect-plus`.
 * @module dsh-codex-connect-plus/invariant
 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = 'dsh-codex-connect-plus'

/** Cordis companion plugin name. */
export const name = 'openai-codex-invariant'
/** Service required before the companion can register. */
export const inject = ['invariants']

// No runtime invariant: the LLM and web registries own provider uniqueness and disposal,
// while credentials and model replies cross file/network boundaries whose
// validation runs in their owning operations. There is no separate mutable
// package relationship to scan.
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
