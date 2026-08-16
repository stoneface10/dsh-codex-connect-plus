/* Adapted for dsh-codex-connect-plus from dsh-image2-draw and dsh-multimodal; Copyright 2026 0751; see THIRD_PARTY_NOTICES.md. */
/** Session-authorized in-conversation card for Codex image generation and editing. */

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import type { ImageLoader } from '@deepseek-ai/dsh-client-ui-attachment'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import { CODEX_IMAGE_EDIT_TOOL_NAME } from '../images/contract.ts'

export interface CodexImageToolViewInjected {
  loadImage: ImageLoader
}

type CodexImageToolViewProps = ToolCallViewProps & Partial<CodexImageToolViewInjected>

const cardStyle: CSSProperties = { boxSizing: 'border-box', maxWidth: 720, padding: '12px 14px', border: '1px solid var(--dsw-alias-border-l1)', borderRadius: 8, background: 'var(--dsw-alias-bg-module-platform)', display: 'flex', flexDirection: 'column', gap: 10 }
const headStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 14, color: 'var(--dsw-alias-label-primary)' }
const metaStyle: CSSProperties = { fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' }
const promptStyle: CSSProperties = { margin: 0, fontSize: 12, lineHeight: '18px', wordBreak: 'break-word', color: 'var(--dsw-alias-label-secondary)', maxHeight: 54, overflow: 'hidden' }
const gridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 248px))', gap: 10 }
const imageStyle: CSSProperties = { display: 'block', width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', border: '1px solid var(--dsw-alias-border-l1)', borderRadius: 6, cursor: 'zoom-in' }
const overlayStyle: CSSProperties = { position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, background: 'rgba(8, 10, 16, .82)', cursor: 'zoom-out' }
const overlayImageStyle: CSSProperties = { maxWidth: '92vw', maxHeight: '86vh', borderRadius: 8 }

function argsOf(block: ToolCallViewProps['block']): Record<string, unknown> {
  const raw = 'kind' in block ? block.call?.argsRaw : block.argsRaw
  if (typeof raw !== 'string' || raw.length === 0) return {}
  try {
    const value: unknown = JSON.parse(raw)
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function imagesOf(block: ToolCallViewProps['block']): readonly ImageAttachmentRef[] {
  if (!('kind' in block)) return []
  return block.content.flatMap(content => content.type === 'image' ? [content.attachment] : [])
}

function AuthorizedImage({ image, loadImage, alt, onOpen }: {
  image: ImageAttachmentRef
  loadImage: ImageLoader
  alt: string
  onOpen: (url: string) => void
}) {
  const [url, setUrl] = useState<string>()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    let owned: string | undefined
    setUrl(undefined)
    setFailed(false)
    void loadImage(image).then((next) => {
      owned = next
      if (live) setUrl(next)
      else URL.revokeObjectURL(next)
    }).catch(() => { if (live) setFailed(true) })
    return () => {
      live = false
      if (owned !== undefined) URL.revokeObjectURL(owned)
    }
  }, [image, loadImage])
  if (failed) return <div style={{ ...imageStyle, cursor: 'default', display: 'grid', placeItems: 'center' }}>预览失败</div>
  if (url === undefined) return <div style={{ ...imageStyle, cursor: 'default', display: 'grid', placeItems: 'center' }}>加载中</div>
  return <img src={url} alt={alt} style={imageStyle} onClick={() => { onOpen(url) }} />
}

/** Render running, failed, and completed gpt-image-2 calls through the owning session. */
export function CodexImageToolView({ toolName, block, loadImage }: CodexImageToolViewProps) {
  const args = useMemo(() => argsOf(block), [block])
  const images = useMemo(() => imagesOf(block), [block])
  const [lightbox, setLightbox] = useState<string>()
  useEffect(() => {
    if (lightbox === undefined) return undefined
    const close = (event: KeyboardEvent): void => { if (event.key === 'Escape') setLightbox(undefined) }
    window.addEventListener('keydown', close)
    return () => { window.removeEventListener('keydown', close) }
  }, [lightbox])
  const title = toolName === CODEX_IMAGE_EDIT_TOOL_NAME ? 'Codex 图片编辑' : 'Codex 文生图'
  const prompt = typeof args['prompt'] === 'string' ? args['prompt'] : undefined
  if (!('kind' in block)) {
    return (
      <div style={cardStyle}>
        <div style={headStyle}><strong>{title}</strong><span style={metaStyle}>生成中</span></div>
        {prompt === undefined ? null : <p style={promptStyle}>{prompt}</p>}
        <span style={metaStyle}>正在等待 gpt-image-2，通常需要数分钟</span>
      </div>
    )
  }
  if (images.length === 0 || loadImage === undefined) {
    const text = block.content.filter(content => content.type === 'text').map(content => content.text).join('\n')
    return (
      <div style={cardStyle}>
        <div style={headStyle}><strong>{title}</strong><span style={metaStyle}>{block.isError ? '失败' : '无图片'}</span></div>
        <p style={{ ...promptStyle, color: block.isError ? 'var(--dsw-alias-state-error-primary)' : undefined }}>{text || '工具没有返回可显示的图片附件'}</p>
      </div>
    )
  }
  return (
    <div style={cardStyle}>
      <div style={headStyle}>
        <strong>{title}</strong>
        <span style={metaStyle}>{images.length} 张 · {images[0]?.width}×{images[0]?.height}</span>
      </div>
      {prompt === undefined ? null : <p style={promptStyle}>{prompt}</p>}
      <div style={gridStyle}>
        {images.map((image, index) => (
          <div key={`${image.attachmentId}:${index}`}>
            <AuthorizedImage
              image={image}
              loadImage={loadImage}
              alt={prompt ?? image.name ?? `Codex image ${index + 1}`}
              onOpen={setLightbox}
            />
            <div style={{ ...metaStyle, marginTop: 6 }}>{image.name ?? `codex-image-${index + 1}.png`}</div>
          </div>
        ))}
      </div>
      {lightbox === undefined ? null : (
        <div style={overlayStyle} role="presentation" onClick={() => { setLightbox(undefined) }}>
          <img src={lightbox} alt={prompt ?? 'Codex image'} style={overlayImageStyle} />
        </div>
      )}
    </div>
  )
}
