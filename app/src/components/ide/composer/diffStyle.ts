export type DiffLineKind = 'add' | 'del' | 'ctx' | 'meta'

export type DiffLine = { kind: DiffLineKind; text: string }

/** Best-effort unified diff line classification for UI (not a full patch parser). */
export function parseDiffLines(code: string): DiffLine[] {
  const lines = code.replace(/\r\n/g, '\n').split('\n')
  const out: DiffLine[] = []
  for (const line of lines) {
    if (
      line.startsWith('+++') ||
      line.startsWith('---') ||
      line.startsWith('@@') ||
      /^\s*diff\s/i.test(line)
    ) {
      out.push({ kind: 'meta', text: line })
      continue
    }
    if (line.startsWith('+')) {
      out.push({ kind: 'add', text: line.slice(1) })
      continue
    }
    if (line.startsWith('-')) {
      out.push({ kind: 'del', text: line.slice(1) })
      continue
    }
    if (line.startsWith(' ') || line === '') {
      out.push({ kind: 'ctx', text: line.startsWith(' ') ? line.slice(1) : line })
      continue
    }
    out.push({ kind: 'ctx', text: line })
  }
  return out
}

/** Short header like `path/to/file.css +2 -1` from diff preamble. */
export function inferDiffTitle(code: string): string | null {
  const lines = code.split('\n').slice(0, 12)
  const fileLine = lines.find((l) => l.startsWith('+++ b/') || l.startsWith('+++ '))
  if (fileLine) {
    if (fileLine.startsWith('+++ b/')) {
      const p = fileLine.slice(6).trim()
      if (p) {
        return p
      }
    }
    const p = fileLine.replace(/^\+\+\+\s*/, '').replace(/^[ab]\//, '').trim()
    if (p) {
      return p
    }
  }
  const comment = lines.find((l) => /^(#|\/\/)\s*file:\s*/i.test(l.trim()))
  if (comment) {
    return comment.replace(/^[^:]*:\s*/i, '').trim()
  }
  return null
}
