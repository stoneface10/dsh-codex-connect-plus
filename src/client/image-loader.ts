/* dsh-codex-connect-plus image attachment integration; Copyright 2026 0751; Apache-2.0, third-party notices in THIRD_PARTY_NOTICES.md. */
/** Session-authorized image loader for generated attachment references. */

import type { ImageLoader } from '@deepseek-ai/dsh-client-ui-attachment'
import type { ISessions, SessionId } from '@deepseek-ai/dsh-client-runtime/client'

/** Create an uncached object-URL loader; the consuming component owns revocation. */
export function createCodexImageLoader(sessions: ISessions, sessionId: SessionId): ImageLoader {
  return async attachment => {
    const session = sessions.binding(sessionId)?.session
    if (session === undefined) throw new Error(`Unknown session: ${sessionId}`)
    const result = await session.readAttachment(attachment.attachmentId)
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
    return URL.createObjectURL(new Blob(
      [Uint8Array.from(result.value.data)],
      { type: result.value.attachment.mediaType },
    ))
  }
}
