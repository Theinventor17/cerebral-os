/**
 * Safe subset for assistant replies: **bold**, `code`, auto-links, bullets, paragraphs.
 */
export function formatComposerHtml(raw: string): string {
  const paras = raw.replace(/\r\n/g, '\n').split(/\n{2,}/)
  return paras
    .map((p) => {
      const lines = p.split('\n')
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

        return `<ul class="ccomp-ul">${items.map((it) => `<li>${formatInline(escapeHtml(it))}</li>`).join('')}</ul>`

      }

      const withBreaks = lines.map((ln) => formatInline(escapeHtml(ln))).join('<br/>')

      return withBreaks ? `<p class="ccomp-p">${withBreaks}</p>` : ''

    })
    .filter(Boolean)
    .join('')

}

function formatInline(escaped: string): string {
  let s = escaped
  s = s.replace(/`([^`]+)`/g, '<code class="ccomp-code">$1</code>')
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong class="ccomp-strong">$1</strong>')
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<]+)(?=$|[<)])/g, (_m, pre, url) => {
    const u = String(url)
    return `${pre}<a href="${u}" class="ccomp-a" target="_blank" rel="noreferrer noopener">${u}</a>`
  })
  return s
}

function escapeHtml(t: string): string {
  return t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
