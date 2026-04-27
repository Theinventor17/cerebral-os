/**
 * Fenced code: prefer GFM (closing ` ``` ` on its own line). If that is missing, accept exactly two
 * ` ``` ` runs in the buffer (open + close) so models that end with `</div>``` ` still parse.
 */

/** Count non-overlapping ``` occurrences (length 3) */
function countTripleBacktickRuns(s: string): number {
  let n = 0
  let p = 0
  while (p < s.length) {
    const i = s.indexOf('```', p)
    if (i < 0) {
      break
    }
    n += 1
    p = i + 3
  }
  return n
}

/**
 * When the buffer has exactly one open and one close (2× ``` total), treat the second as the closing
 * fence even if it sits on the same line as the last line of code.
 */
function takeTwoRunFence(buf: string): { langLine: string; code: string; rest: string } | null {
  if (countTripleBacktickRuns(buf) !== 2) {
    return null
  }
  const a = buf.indexOf('```')
  const b = buf.indexOf('```', a + 3)
  if (a < 0 || b < 0) {
    return null
  }
  const firstNl = buf.indexOf('\n', a)
  if (firstNl === -1 || b <= firstNl) {
    return null
  }
  const langLine = buf.slice(a + 3, firstNl).trim()
  const codeStart = firstNl + 1
  if (b <= codeStart) {
    return null
  }
  return { langLine, code: buf.slice(codeStart, b), rest: buf.slice(b + 3) }
}

/** If buffer starts a complete line-closed fence, return parsed pieces and the tail after the closing line. */
export function takeFirstLineClosedFence(
  buf: string
): { langLine: string; code: string; rest: string } | null {
  const start = buf.indexOf('```')
  if (start === -1) {
    return null
  }
  const firstNl = buf.indexOf('\n', start)
  if (firstNl === -1) {
    return null
  }
  const langLine = buf.slice(start + 3, firstNl).trim()
  const codeStart = firstNl + 1
  let pos = codeStart
  while (pos <= buf.length) {
    const nl = buf.indexOf('\n', pos)
    const line = nl === -1 ? buf.slice(pos) : buf.slice(pos, nl)
    if (/^[ \t]*`{3,}[ \t]*$/.test(line.replace(/\r$/, ''))) {
      const code = buf.slice(codeStart, pos)
      const after = nl === -1 ? buf.length : nl + 1
      return { langLine, code, rest: buf.slice(after) }
    }
    if (nl === -1) {
      return takeTwoRunFence(buf)
    }
    pos = nl + 1
  }
  return takeTwoRunFence(buf)
}

/**
 * All line-closed fences in document order, with 0-based `start` = index of the opening ` ``` `.
 */
export function allLineClosedFences(text: string): Array<{
  start: number
  /** Index in `text` after the newline that follows the closing ``` line. */
  end: number
  langLine: string
  content: string
}> {
  const s = text.replace(/\r\n/g, '\n')
  const out: Array<{ start: number; end: number; langLine: string; content: string }> = []
  let i = 0
  while (i < s.length) {
    const start = s.indexOf('```', i)
    if (start === -1) {
      break
    }
    const t = takeFirstLineClosedFence(s.slice(start))
    if (!t) {
      i = start + 3
      continue
    }
    const end = s.length - t.rest.length
    out.push({ start, end, langLine: t.langLine, content: t.code })
    i = end
  }
  return out
}
