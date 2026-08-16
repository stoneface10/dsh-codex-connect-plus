import { mkdir, mkdtemp, readFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { OpenAICodexAuthRuntime } from '../src/auth-runtime.ts'
import {
  CODEX_IMAGE_EDIT_TOOL_NAME,
  CODEX_IMAGE_GENERATE_TOOL_NAME,
  ensureSafeCodexImageOutputRoot,
  registerCodexImageTools,
  writeExclusiveCodexImage,
} from '../src/images/tools.ts'

describe('Codex image tools', () => {
  it('registers strict generate and edit definitions with native image output', () => {
    const tools: ToolDefinition[] = []
    const ctx = {
      tools: { register(tool: ToolDefinition) { tools.push(tool) } },
    } as unknown as Context
    registerCodexImageTools(ctx, {} as OpenAICodexAuthRuntime)
    expect(tools.map(tool => tool.name)).toEqual([
      CODEX_IMAGE_GENERATE_TOOL_NAME,
      CODEX_IMAGE_EDIT_TOOL_NAME,
    ])
    const generate = tools[0]
    expect(generate?.parameters).toHaveProperty('properties.prompt.type', 'string')
    expect(generate?.parameters).toHaveProperty('required', ['prompt'])
    expect(generate?.output.schema).toHaveProperty('additionalProperties', false)
    expect(generate?.output.schema).toHaveProperty('properties.images.items.additionalProperties', false)
    const content = generate?.output.render({}, {
      files: ['C:/workspace/outputs/codex-image/test.png'],
      images: [{
        attachmentId: `sha256:${'a'.repeat(64)}`,
        mediaType: 'image/png',
        bytes: 12,
        width: 1,
        height: 1,
        name: 'test.png',
      }],
      provider: 'openai-codex',
      model: 'gpt-image-2',
      size: '1024x1024',
      quality: 'low',
      mode: 'generate',
    })
    expect(content?.some(block => block.type === 'image')).toBe(true)
  })

  it('rejects a linked output parent instead of writing outside the session cwd', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-codex-connect-plus-output-root-'))
    const outside = await mkdtemp(join(tmpdir(), 'dsh-codex-connect-plus-output-outside-'))
    try {
      await symlink(outside, join(root, 'outputs'), process.platform === 'win32' ? 'junction' : 'dir')
      await expect(ensureSafeCodexImageOutputRoot(root)).rejects.toThrow(/symbolic link or junction/u)
    } finally {
      await Promise.all([
        rm(root, { recursive: true, force: true }),
        rm(outside, { recursive: true, force: true }),
      ])
    }
  })

  it('creates a normal contained output directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-codex-connect-plus-output-root-'))
    try {
      expect(await ensureSafeCodexImageOutputRoot(root)).toBe(join(root, 'outputs', 'codex-image'))
      await expect(mkdir(join(root, 'outputs', 'codex-image'))).rejects.toMatchObject({ code: 'EEXIST' })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('allocates output filenames atomically instead of overwriting concurrent results', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-codex-connect-plus-output-'))
    try {
      const intended = join(root, 'codex-image.png')
      const [first, second] = await Promise.all([
        writeExclusiveCodexImage(intended, Uint8Array.from([1])),
        writeExclusiveCodexImage(intended, Uint8Array.from([2])),
      ])
      expect(new Set([first, second])).toEqual(new Set([intended, join(root, 'codex-image-2.png')]))
      const stored = await Promise.all([readFile(first), readFile(second)])
      expect(stored.map(data => data[0]).sort()).toEqual([1, 2])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
