/* dsh-codex-connect-plus image attachment integration; Copyright 2026 0751; Apache-2.0, third-party notices in THIRD_PARTY_NOTICES.md. */
/** Session-authorized image loader for generated attachment references. */

import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** Resolve a generated attachment to a short-lived browser object URL. */
export type CodexImageLoader = (attachment: ImageAttachmentRef) => Promise<string>

/** Create an uncached object-URL loader; the consuming component owns revocation. */
export function createCodexImageLoader(sessions: ISessions, sessionId: SessionId): CodexImageLoader {
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
