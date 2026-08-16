// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import { CodexImageToolView } from '../src/client/CodexImageToolView.tsx'
import { CODEX_IMAGE_GENERATE_TOOL_NAME } from '../src/images/tools.ts'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Codex image tool view', () => {
  it('loads native attachment blocks through the injected session loader and revokes previews', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const loadImage = vi.fn(async () => 'blob:session-authorized')
    const block = {
      kind: 'result',
      call: { argsRaw: JSON.stringify({ prompt: 'a red panda' }) },
      content: [{
        type: 'image',
        attachment: {
          attachmentId: `sha256:${'a'.repeat(64)}`,
          mediaType: 'image/png',
          bytes: 12,
          width: 1024,
          height: 1024,
          name: 'panda.png',
        },
      }],
      isError: false,
    }
    const props = {
      toolName: CODEX_IMAGE_GENERATE_TOOL_NAME,
      callId: 'call-1',
      block,
      cwd: 'C:/workspace',
      openFile: () => undefined,
      inspect: () => undefined,
    } as unknown as ToolCallViewProps
    const rendered = render(<CodexImageToolView {...props} loadImage={loadImage} />)
    expect((await screen.findByAltText('a red panda')).getAttribute('src')).toBe('blob:session-authorized')
    expect(screen.getByText('1 张 · 1024×1024')).toBeTruthy()
    rendered.unmount()
    await waitFor(() => { expect(revoke).toHaveBeenCalledWith('blob:session-authorized') })
  })

  it('shows a non-retrying running state', () => {
    const props = {
      toolName: CODEX_IMAGE_GENERATE_TOOL_NAME,
      callId: 'call-2',
      block: { argsRaw: JSON.stringify({ prompt: 'poster' }) },
      cwd: 'C:/workspace',
      openFile: () => undefined,
      inspect: () => undefined,
    } as unknown as ToolCallViewProps
    render(<CodexImageToolView {...props} />)
    expect(screen.getByText('生成中')).toBeTruthy()
    expect(screen.getByText(/通常需要数分钟/u)).toBeTruthy()
  })
})
