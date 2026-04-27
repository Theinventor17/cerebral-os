import { useCallback, type MouseEvent, type ReactNode } from 'react'
import type { ComposerWorkflowMode } from '@/types'
import { formatProseToHtml, type ProseFormatOptions } from './proseFormat'
import { inferDiffTitle, parseDiffLines, type DiffLineKind } from './diffStyle'
import { isDiffFence, splitFencedContent } from './parseFencedBlocks'

function looksLikeDiff(code: string): boolean {
  const t = code.trim()
  if (!t) {
    return false
  }
  if (/^diff\s/i.test(t) || t.startsWith('---') || t.startsWith('+++') || t.startsWith('@@')) {
    return true
  }
  const hasAdd = /(^|\n)\+[^\n]*/.test(t) && !/^\+\+\+/.test(t)
  const hasDel = /(^|\n)-[^\n]*/.test(t) && !/^---[^\n]*/.test(t)
  return hasAdd && hasDel
}

function DiffViewer({ code }: { code: string }): ReactNode {
  const title = inferDiffTitle(code)
  const lines = parseDiffLines(code)
  const ch = countChanges(lines)
  const head = title ? (ch ? `${title} · ${ch}` : title) : ch ? `Patch · ${ch}` : 'Patch'
  return (
    <div className="ccomp-diff">
      <div className="ccomp-diff-h">{head}</div>
      <div className="ccomp-diff-body">
        {lines.map((l, j) => (
          <div key={j} className={lineClass(l.kind)} role="row">
            <span className="ccomp-diff-sym" aria-hidden>
              {sym(l.kind)}
            </span>
            <span className="ccomp-diff-txt">{l.text || ' '}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function countChanges(lines: { kind: DiffLineKind }[]): string {
  let a = 0
  let d = 0
  for (const l of lines) {
    if (l.kind === 'add') {
      a++
    }
    if (l.kind === 'del') {
      d++
    }
  }
  return d > 0 || a > 0 ? `+${a} -${d}` : ''
}

function sym(k: DiffLineKind): string {
  if (k === 'add') {
    return '+'
  }
  if (k === 'del') {
    return '−'
  }
  if (k === 'meta') {
    return ' '
  }
  return ' '
}

function lineClass(k: DiffLineKind): string {
  if (k === 'add') {
    return 'ccomp-diff-ln ccomp-diff-ln--add'
  }
  if (k === 'del') {
    return 'ccomp-diff-ln ccomp-diff-ln--del'
  }
  if (k === 'meta') {
    return 'ccomp-diff-ln ccomp-diff-ln--meta'
  }
  return 'ccomp-diff-ln ccomp-diff-ln--ctx'
}

function CodeFence({ lang, code }: { lang: string; code: string }): ReactNode {
  const label = lang || 'code'
  return (
    <div className="ccomp-fence">
      <div className="ccomp-fence-h">{label}</div>
      <pre className="ccomp-fence-pre">
        <code>{code}</code>
      </pre>
    </div>
  )
}

export function ComposerAssistantBody({
  content,
  workflow,
  workspaceRoot = null,
  onOpenWorkspaceFile
}: {
  content: string
  workflow: ComposerWorkflowMode
  /** When set, backtick file paths in prose open in the editor. */
  workspaceRoot?: string | null
  onOpenWorkspaceFile?: (relativePath: string) => void
}): ReactNode {
  const fmtOpts: ProseFormatOptions | undefined =
    onOpenWorkspaceFile != null ? { workspaceRoot: workspaceRoot ?? null } : undefined
  const onProseClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (!onOpenWorkspaceFile) {
        return
      }
      const el = (e.target as HTMLElement).closest('button.ccomp-file-link') as HTMLButtonElement | null
      if (!el) {
        return
      }
      e.preventDefault()
      const enc = el.getAttribute('data-cerebral-file')
      if (enc) {
        onOpenWorkspaceFile(decodeURIComponent(enc))
      }
    },
    [onOpenWorkspaceFile]
  )
  const segments = splitFencedContent(content)
  return (
    <div className={`ccomp-rich ccomp-rich--${workflow}`}>
      {segments.map((seg, i) => {
        if (seg.type === 'prose') {
          if (!seg.text.trim()) {
            return null
          }
          return (
            <div
              key={i}
              className="ccomp-rich-prose"
              onClick={onProseClick}
              role={onOpenWorkspaceFile ? 'group' : undefined}
              dangerouslySetInnerHTML={{ __html: formatProseToHtml(seg.text, fmtOpts) }}
            />
          )
        }
        const lang = seg.lang
        const isDiff = isDiffFence(lang) || (!lang && looksLikeDiff(seg.code))
        if (isDiff) {
          return <DiffViewer key={i} code={seg.code} />
        }
        return <CodeFence key={i} lang={lang} code={seg.code} />
      })}
    </div>
  )
}
