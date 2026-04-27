import { allLineClosedFences } from '@/utils/markdownFences'

/** Split assistant text into prose (markdown-like) and fenced code regions. */
export type FencedSegment =
  | { type: 'prose'; text: string }
  | { type: 'fence'; lang: string; code: string }

export function splitFencedContent(raw: string): FencedSegment[] {
  const s = raw.replace(/\r\n/g, '\n')
  const blocks = allLineClosedFences(s)
  if (blocks.length === 0) {
    return s.length ? [{ type: 'prose' as const, text: s }] : []
  }
  const out: FencedSegment[] = []
  let last = 0
  for (const b of blocks) {
    if (b.start > last) {
      out.push({ type: 'prose', text: s.slice(last, b.start) })
    }
    const lang = (b.langLine || '').toLowerCase().trim().split(/\s+/)[0] ?? ''
    out.push({ type: 'fence', lang, code: b.content })
    last = b.end
  }
  if (last < s.length) {
    out.push({ type: 'prose', text: s.slice(last) })
  }
  if (out.length === 0) {
    return [{ type: 'prose' as const, text: s }]
  }
  return out
}

export function isDiffFence(lang: string): boolean {
  return lang === 'diff' || lang.startsWith('diff-') || lang === 'patch' || lang === 'udiff'
}
