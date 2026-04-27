/** Default label for a new session before the first user message is sent. */
export const DEFAULT_SESSION_TITLE = 'Live session'

const MAX_LEN = 80

/**
 * One-line title from the user's first message (no LLM): first line, collapsed whitespace, capped length.
 * Returns `null` if there is no usable text.
 */
export function deriveSessionTitleFromUserMessage(text: string): string | null {
  const line = text.trim().split(/\r?\n/)[0]?.trim() ?? ''
  if (!line) {
    return null
  }
  const collapsed = line.replace(/\s+/g, ' ').trim()
  if (!collapsed) {
    return null
  }
  if (collapsed.length <= MAX_LEN) {
    return collapsed
  }
  return `${collapsed.slice(0, MAX_LEN - 1).trimEnd()}…`
}

export function formatSessionListTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  } catch {
    return ''
  }
}

export function isDefaultSessionTitle(title: string): boolean {
  return title.trim() === DEFAULT_SESSION_TITLE
}
