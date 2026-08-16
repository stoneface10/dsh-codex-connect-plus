/* Adapted for dsh-codex-connect-plus from dsh-image2-draw and codex-gpt-image; Copyright 2026 0751; see THIRD_PARTY_NOTICES.md. */
/** Harness-native gpt-image-2 generation/edit tools and durable image presentation. */

import { lstat, mkdir, realpath, writeFile } from 'node:fs/promises'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-fs'
import { AttachmentId } from '@deepseek-ai/dsh-attachment'
import type { ImageAttachmentRef, ImageMediaType } from '@deepseek-ai/dsh-attachment'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolExecution } from '@deepseek-ai/dsh-tools'
import type { OpenAICodexAuthRuntime } from '../auth-runtime.ts'
import {
  CODEX_IMAGE_MAX_INPUT_BYTES,
  CODEX_IMAGE_MAX_INPUTS,
  CODEX_IMAGE_MODEL,
  createCodexImageRequest,
  detectCodexImageType,
  imageDataUrl,
  requestCodexImages,
} from './protocol.ts'
import type { CodexImageMode } from './protocol.ts'
export { CODEX_IMAGE_EDIT_TOOL_NAME, CODEX_IMAGE_GENERATE_TOOL_NAME } from './contract.ts'
import { CODEX_IMAGE_EDIT_TOOL_NAME, CODEX_IMAGE_GENERATE_TOOL_NAME } from './contract.ts'
const OUTPUT_DIR = 'outputs/codex-image'
const MAX_AGGREGATE_INPUT_BYTES = 32 * 1024 * 1024

interface LoadedLocalImage {
  image_url: string
  bytes: number
}

interface CodexImageValueRef {
  attachmentId: string
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp'
  bytes: number
  width: number
  height: number
  name?: string
}

interface CodexImageValue {
  files: string[]
  images: CodexImageValueRef[]
  provider: 'openai-codex'
  model: typeof CODEX_IMAGE_MODEL
  size: string
  quality: string
  mode: CodexImageMode
  revisedPrompt?: string
}

interface CommonImageArgs {
  prompt: string
  size?: string
  quality?: string
  background?: string
  moderation?: string
  count?: number
}

interface EditImageArgs extends CommonImageArgs {
  refs: string[]
  mask?: string
}

function sessionCwd(exec: ToolExecution): string {
  return exec.agent?.session.header.cwd ?? process.cwd()
}

function timestamp(date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

/** Create the fixed output directory without following user-controlled links or junctions. */
export async function ensureSafeCodexImageOutputRoot(cwd: string): Promise<string> {
  const outputParent = resolve(cwd, 'outputs')
  const outputRoot = resolve(cwd, OUTPUT_DIR)
  for (const path of [outputParent, outputRoot]) {
    let info
    try {
      info = await lstat(path)
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException | null)?.code !== 'ENOENT') throw error
      try { await mkdir(path) } catch (mkdirError: unknown) {
        if ((mkdirError as NodeJS.ErrnoException | null)?.code !== 'EEXIST') throw mkdirError
      }
      info = await lstat(path)
    }
    if (info.isSymbolicLink()) throw new Error(`Codex image output directory must not be a symbolic link or junction: ${path}`)
    if (!info.isDirectory()) throw new Error(`Codex image output path is not a directory: ${path}`)
  }
  const [canonicalCwd, canonicalRoot] = await Promise.all([realpath(cwd), realpath(outputRoot)])
  const within = relative(canonicalCwd, canonicalRoot)
  if (within === '..' || within.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(within)) {
    throw new Error('Codex image output directory resolves outside the session cwd')
  }
  return outputRoot
}

export async function writeExclusiveCodexImage(path: string, data: Uint8Array): Promise<string> {
  for (let index = 1; index < 10_000; index += 1) {
    const candidate = index === 1 ? path : path.replace(/(\.[^./\\]+)?$/u, `-${index}$1`)
    try {
      await writeFile(candidate, data, { flag: 'wx' })
      return candidate
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException | null)?.code !== 'EEXIST') throw error
    }
  }
  throw new Error('could not allocate a Codex image output filename')
}

function attachmentRef(image: CodexImageValueRef): ImageAttachmentRef {
  return {
    attachmentId: AttachmentId(image.attachmentId),
    mediaType: image.mediaType,
    bytes: image.bytes,
    width: image.width,
    height: image.height,
    ...image.name === undefined ? {} : { name: image.name },
  }
}

function renderImageResult(_args: unknown, value: CodexImageValue): ContentBlock[] {
  return [
    {
      type: 'text',
      text: `Codex ${value.mode === 'edit' ? '图片编辑' : '文生图'}完成：${value.model} · ${value.size} · ${value.quality}\n图片已保存到 ${OUTPUT_DIR}。`,
    },
    ...value.images.map(image => ({ type: 'image' as const, attachment: attachmentRef(image) })),
  ]
}

async function readLocalImage(ctx: Context, path: string, cwd: string, signal?: AbortSignal): Promise<LoadedLocalImage> {
  signal?.throwIfAborted()
  const pathInfo = await ctx.fs.lstat(path, { cwd }, signal)
  if (pathInfo?.type === 'symlink') throw new Error(`reference image must not be a symbolic link: ${path}`)
  if (pathInfo?.type !== 'file') throw new Error(`reference is not a file: ${path}`)
  if (pathInfo.size !== undefined && pathInfo.size > CODEX_IMAGE_MAX_INPUT_BYTES) throw new Error(`reference image exceeds 4MB: ${path}`)
  const target = await ctx.fs.resolve(path, { cwd, ...signal === undefined ? {} : { signal } })
  const info = await ctx.fs.stat(target, signal)
  if (info?.type !== 'file') throw new Error(`reference is not a file: ${path}`)
  if (info.size !== undefined && info.size > CODEX_IMAGE_MAX_INPUT_BYTES) throw new Error(`reference image exceeds 4MB: ${path}`)
  const data = await ctx.fs.readBytes(target, signal, CODEX_IMAGE_MAX_INPUT_BYTES)
  signal?.throwIfAborted()
  const type = detectCodexImageType(data)
  return { image_url: imageDataUrl(data, type.mediaType), bytes: data.byteLength }
}

async function readReferences(ctx: Context, paths: readonly string[], exec: ToolExecution): Promise<LoadedLocalImage[]> {
  if (paths.length === 0) throw new Error('at least one reference image is required')
  if (paths.length > CODEX_IMAGE_MAX_INPUTS) throw new Error(`at most ${CODEX_IMAGE_MAX_INPUTS} reference images are supported`)
  const cwd = sessionCwd(exec)
  const loaded: LoadedLocalImage[] = []
  let aggregateBytes = 0
  for (const path of paths) {
    const image = await readLocalImage(ctx, path, cwd, exec.signal)
    aggregateBytes += image.bytes
    if (aggregateBytes > MAX_AGGREGATE_INPUT_BYTES) throw new Error('reference images exceed the 32MB aggregate limit')
    loaded.push(image)
  }
  return loaded
}

async function executeImage(
  ctx: Context,
  auth: OpenAICodexAuthRuntime,
  mode: CodexImageMode,
  args: CommonImageArgs | EditImageArgs,
  exec: ToolExecution,
): Promise<CodexImageValue> {
  const images = mode === 'edit' ? await readReferences(ctx, (args as EditImageArgs).refs, exec) : undefined
  const mask = mode === 'edit' && (args as EditImageArgs).mask !== undefined
    ? await readLocalImage(ctx, (args as EditImageArgs).mask!, sessionCwd(exec), exec.signal)
    : undefined
  if ((images?.reduce((total, image) => total + image.bytes, 0) ?? 0) + (mask?.bytes ?? 0) > MAX_AGGREGATE_INPUT_BYTES) {
    throw new Error('reference images and mask exceed the 32MB aggregate limit')
  }
  const request = createCodexImageRequest({
    prompt: args.prompt,
    ...args.size === undefined ? {} : { size: args.size },
    ...args.quality === undefined ? {} : { quality: args.quality },
    ...args.background === undefined ? {} : { background: args.background },
    ...args.moderation === undefined ? {} : { moderation: args.moderation },
    ...args.count === undefined ? {} : { count: args.count },
    ...images === undefined ? {} : { images: images.map(image => ({ image_url: image.image_url })) },
    ...mask === undefined ? {} : { mask: { image_url: mask.image_url } },
  })
  const payloads = await requestCodexImages({ auth, mode, body: request, signal: exec.signal })
  const outputRoot = await ensureSafeCodexImageOutputRoot(sessionCwd(exec))
  const files: string[] = []
  const attachmentValues: CodexImageValueRef[] = []
  for (const [index, payload] of payloads.entries()) {
    const suffix = payloads.length > 1 ? `-${index + 1}` : ''
    const intended = join(outputRoot, `codex-image-${timestamp()}${suffix}${payload.type.extension}`)
    const file = await writeExclusiveCodexImage(intended, payload.data)
    files.push(file)
    const saved = await ctx.attachments.saveImage({
      data: payload.data,
      mediaType: payload.type.mediaType as ImageMediaType,
      name: basename(file),
    })
    attachmentValues.push({
      attachmentId: saved.attachmentId,
      mediaType: saved.mediaType as CodexImageValueRef['mediaType'],
      bytes: saved.bytes,
      width: saved.width,
      height: saved.height,
      ...saved.name === undefined ? {} : { name: saved.name },
    })
  }
  return {
    files,
    images: attachmentValues,
    provider: 'openai-codex',
    model: CODEX_IMAGE_MODEL,
    size: request.size,
    quality: request.quality,
    mode,
    ...payloads[0]?.revisedPrompt === undefined ? {} : { revisedPrompt: payloads[0].revisedPrompt },
  }
}

const outputSchema = {
  type: 'object' as const,
  additionalProperties: false,
  properties: {
    files: { type: 'array' as const, required: true, items: { type: 'string' as const } },
    images: {
      type: 'array' as const,
      required: true,
      items: {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          attachmentId: { type: 'string' as const, required: true },
          mediaType: { type: 'string' as const, required: true, enum: ['image/png', 'image/jpeg', 'image/webp'] as const },
          bytes: { type: 'integer' as const, required: true },
          width: { type: 'integer' as const, required: true },
          height: { type: 'integer' as const, required: true },
          name: { type: 'string' as const },
        },
      },
    },
    provider: { type: 'string' as const, required: true, const: 'openai-codex' },
    model: { type: 'string' as const, required: true, const: CODEX_IMAGE_MODEL },
    size: { type: 'string' as const, required: true },
    quality: { type: 'string' as const, required: true },
    mode: { type: 'string' as const, required: true, enum: ['generate', 'edit'] as const },
    revisedPrompt: { type: 'string' as const },
  },
} as const

const commonParameters = {
  prompt: { type: 'string' as const, required: true, description: 'Detailed production prompt covering composition, style, lighting, color, materials, constraints, and exact required text.' },
  size: { type: 'string' as const, description: 'adaptive (default), portrait, landscape, square, or WIDTHxHEIGHT; multiples of 16, longest edge <=3840, ratio <=3:1.' },
  quality: { type: 'string' as const, description: 'low, medium, high, or auto (default).' },
  background: { type: 'string' as const, description: 'auto (default) or opaque; gpt-image-2 does not support transparent output here.' },
  moderation: { type: 'string' as const, description: 'auto (default) or low.' },
  count: { type: 'number' as const, description: 'Number of images from 1 to 4; default 1.' },
} as const

/** Register generation/edit tools plus a private attachment reader for their client card. */
export function registerCodexImageTools(ctx: Context, auth: OpenAICodexAuthRuntime): void {
  ctx.tools.register(defineTool({
    name: CODEX_IMAGE_GENERATE_TOOL_NAME,
    description: 'Generate 1-4 images with gpt-image-2 through the ChatGPT/Codex OAuth session already signed in to Codex Connect Plus. Saves files under the current session outputs/codex-image directory. Requests may take minutes; do not retry automatically after failure or timeout.',
    parameters: commonParameters,
    output: { schema: outputSchema, render: renderImageResult },
    isConcurrencySafe: () => true,
    execute: (args, exec) => executeImage(ctx, auth, 'generate', args, exec),
  }))
  ctx.tools.register(defineTool({
    name: CODEX_IMAGE_EDIT_TOOL_NAME,
    description: 'Edit 1-8 local PNG/JPEG/WebP reference images (each <=4MB) with gpt-image-2 through the existing ChatGPT/Codex OAuth session. Relative paths resolve from the current session cwd.',
    parameters: {
      ...commonParameters,
      refs: { type: 'array' as const, required: true, items: { type: 'string' as const }, description: 'Reference image paths (1-8).' },
      mask: { type: 'string' as const, description: 'Optional local mask image path.' },
    },
    output: { schema: outputSchema, render: renderImageResult },
    isConcurrencySafe: () => true,
    execute: (args, exec) => executeImage(ctx, auth, 'edit', args, exec),
  }))

}
