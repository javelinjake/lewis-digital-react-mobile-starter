import { assetUrl, prepareHtml } from '@/lib/assets'
import { isHtml } from '@/lib/content-text'

export function MediaImage({ file, alt = '', className = '' }: { file?: string | null, alt?: string, className?: string }) {
  const src = assetUrl(file)
  if (!src)
    return null

  return <img src={src} alt={alt} className={className} />
}

export function RichText({ html, className = '' }: { html?: string | null, className?: string }) {
  if (!html?.trim())
    return null

  return <div className={`rich-text ${className}`} dangerouslySetInnerHTML={{ __html: prepareHtml(html) }} />
}

export function ContentBody({ value, className = '' }: { value?: string | null, className?: string }) {
  if (!value?.trim())
    return null

  if (isHtml(value))
    return <RichText html={value} className={className} />

  return <p className={className}>{value}</p>
}
