/**
 * Prose formatter: **bold**, `code`, links, optional file-path buttons, and markdown images (https only).
 */
const IMG_RE = /!\[([^\]]*)\]\((https:[^)]+)\)/g

const FILE_LIKE = /\.(html?|css|m?js|mjs|cjs|json|tsx?|md|vue|svelte|scss|less|ts|rs|go|py|xml|svg|ya?ml|toml|wasm|sh|ps1)($|[?#])/i

function escapeHtml(t: string): string {
  return t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function decodeBasicEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

/**
 * Map a backtick value (relative path or an absolute path under the workspace) to a workspace-relative path.
 * Returns null if the segment should stay a normal inline `code` span.
 */
export function toWorkspaceRelPath(maybe: string, workspaceRoot: string | null): string | null {
  const t = String(maybe).trim()
  if (!t || t.length > 800 || t.includes('`') || /\n/.test(t) || t.includes('..') || /^(https?:|mailto:)/i.test(t)) {
    return null
  }
  if (workspaceRoot) {
    const w = workspaceRoot.replace(/\\/g, '/').replace(/\/$/, '')
    const p = t.replace(/\\/g, '/')
    if (p.length > w.length + 1 && p.toLowerCase().startsWith(w.toLowerCase() + '/')) {
      let rel = p.slice(w.length + 1).replace(/^\//, '')
      if (rel.endsWith('/')) {
        rel = `${rel.replace(/\/+$/, '')}/index.html`
      }
      return rel
    }
  }
  if (/^[A-Za-z]:[\\/]/.test(t) || t.startsWith('//') || t.startsWith('\\\\')) {
    return null
  }
  if (!/[/\\]/.test(t) && !FILE_LIKE.test(t)) {
    return null
  }
  if (!FILE_LIKE.test(t) && !/[/\\]/.test(t)) {
    return null
  }
  let out = t.replace(/\\/g, '/').replace(/^\//, '')
  /** `my-app/` in backticks → open `my-app/index.html` (a directory is not a readable file). */
  if (out.endsWith('/')) {
    out = `${out.replace(/\/+$/, '')}/index.html`
  }
  return out
}

export type ProseFormatOptions = { workspaceRoot: string | null }

function formatInline(escaped: string, opts?: ProseFormatOptions): string {
  let s = escaped
  s = s.replace(/`([^`]+)`/g, (_, rawEscaped) => {
    const inner = decodeBasicEntities(String(rawEscaped))
    const rel = toWorkspaceRelPath(inner, opts?.workspaceRoot ?? null)
    if (rel) {
      return `<button type="button" class="ccomp-file-link" data-cerebral-file="${encodeURIComponent(rel)}"><span class="ccomp-file-link-txt">${String(rawEscaped)}</span></button>`
    }
    return `<code class="ccomp-code">${String(rawEscaped)}</code>`
  })
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong class="ccomp-strong">$1</strong>')
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<]+)(?=$|[<)])/g, (_m, pre, url) => {
    const u = String(url)
    return `${pre}<a href="${u}" class="ccomp-a" target="_blank" rel="noreferrer noopener">${u}</a>`
  })
  return s
}

/** Turn a prose segment into HTML paragraphs + lists + images. */
export function formatProseToHtml(text: string, opts?: ProseFormatOptions): string {
  const raw = text.replace(/\r\n/g, '\n')
  const parts: string[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = IMG_RE.exec(raw)) !== null) {
    if (m.index > last) {
      parts.push(blockFromPlain(raw.slice(last, m.index), opts))
    }
    const alt = escapeHtml(m[1] ?? '')
    const src = m[2]
    parts.push(
      `<figure class="ccomp-fig"><img class="ccomp-gen-img" src="${src}" alt="${alt}" loading="lazy" referrerpolicy="no-referrer" /></figure>`
    )
    last = m.index + m[0].length
  }
  if (last < raw.length) {
    parts.push(blockFromPlain(raw.slice(last), opts))
  }
  if (parts.length === 0) {
    parts.push(blockFromPlain(raw, opts))
  }
  return parts.join('')
}

function blockFromPlain(p: string, opts?: ProseFormatOptions): string {
  const paras = p.split(/\n{2,}/)
  return paras
    .map((block) => {
      const lines = block.split('\n')
      if (
        lines.length > 0 &&
        lines.every((ln) => {
          const t = ln.trim()
          return t.length === 0 || /^[-*•]\s+/.test(t)
        })
      ) {
        const items = lines
          .map((ln) => ln.trim())
          .filter(Boolean)
          .map((ln) => ln.replace(/^[-*•]\s+/, ''))
        if (items.length === 0) {
          return ''
        }
        return `<ul class="ccomp-ul">${items.map((it) => `<li>${formatInline(escapeHtml(it), opts)}</li>`).join('')}</ul>`
      }
      const withBreaks = lines.map((ln) => formatInline(escapeHtml(ln), opts)).join('<br/>')
      return withBreaks ? `<p class="ccomp-p">${withBreaks}</p>` : ''
    })
    .filter(Boolean)
    .join('')
}
