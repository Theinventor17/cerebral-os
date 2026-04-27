import { useMemo, useState, type ReactNode } from 'react'
import { AGENT_MARKETPLACE_TEMPLATES } from '../agents/defaultTemplates'
import claudeBundle from '../data/claudeSkillsCatalog.json'
import type { ClaudeSkillCatalogEntry, ClaudeSkillsCatalog } from '../types/claudeSkills'
import { categoriesWithCount, filterCatalogSkills, humanizeCategory, sortCatalogSkills } from '@/cerebral/skill/skillCatalogQuery'

const catalog = claudeBundle as ClaudeSkillsCatalog
const PAGE_SIZE = 24
const REPO = catalog.upstream

function splitDesc(desc: string, max = 320): { short: string; hasMore: boolean } {
  if (desc.length <= max) {
    return { short: desc, hasMore: false }
  }
  return { short: desc.slice(0, max).trim() + '…', hasMore: true }
}

export function AgentMarketplace() {
  const { skills, generatedAt, count } = catalog
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>('')
  const [page, setPage] = useState(0)

  const categories = useMemo(() => categoriesWithCount(skills), [skills])

  const filtered = useMemo(
    () => sortCatalogSkills(filterCatalogSkills(skills, { q, category: cat }), 'title'),
    [skills, q, cat]
  )

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const slice = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)

  return (
    <div className="ra-screen ra-mp">
      <div className="ra-mp-hero">
        <h1 className="ra-h1">Agent marketplace</h1>
        <p className="ra-mute" style={{ maxWidth: 720, lineHeight: 1.45 }}>
          Built-in CEREBRAL agent templates and the full <strong style={{ color: 'var(--text-primary)' }}>{count}+</strong> skill library from the{' '}
          <a href={REPO} target="_blank" rel="noreferrer" style={{ color: 'var(--cyan)' }}>
            alirezarezvani/claude-skills
          </a>{' '}
          collection (Claude Code / Codex / Cursor-compatible SKILL.md). Use search and categories to find a role; open GitHub for install instructions in each repo folder.
        </p>
        <p className="ra-mp-meta">
          Catalog generated {new Date(generatedAt).toLocaleString()} · {filtered.length}{' '}
          {filtered.length === 1 ? 'skill' : 'skills'}
          {cat || q ? ' (filtered)' : ''}
        </p>
      </div>

      <div className="ra-mp-section">
        <h2>CEREBRAL templates</h2>
        <div className="ra-mp-grid">
          {AGENT_MARKETPLACE_TEMPLATES.map((t) => (
            <div key={t.id} className="ra-mp-card ra-mp-card--tpl">
              <span className="ra-mp-card-badg">CEREBRAL · built-in</span>
              <h3 style={{ color: 'var(--text-primary)' }}>{t.name}</h3>
              <p className="ra-mute" style={{ fontSize: 12, margin: 0, lineHeight: 1.35 }}>
                {t.role}
              </p>
              <div className="ra-mp-actions">
                <button type="button" className="ra-btn ra-btn-sm ra-btn-ghost" style={{ width: '100%' }}>
                  Import template
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="ra-mp-section">
        <h2>Claude skills library</h2>
        <div className="ra-mp-toolbar">
          <input
            className="ra-mp-search"
            type="search"
            placeholder="Search title, path, description, tools…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(0)
            }}
            autoComplete="off"
          />
          <select
            className="ra-mp-select"
            value={cat}
            onChange={(e) => {
              setCat(e.target.value)
              setPage(0)
            }}
            aria-label="Filter by category"
          >
            <option value="">All categories ({skills.length})</option>
            {categories.map(([c, n]) => (
              <option key={c} value={c}>
                {humanizeCategory(c)} ({n})
              </option>
            ))}
          </select>
          <span className="ra-mp-count">
            {filtered.length} skills · {categories.length} categories
          </span>
        </div>
        <div className="ra-mp-cats" aria-label="Category shortcuts">
          <button type="button" className={`ra-mp-chip ${cat === '' ? 'ra-on' : ''}`} onClick={() => setCat('')}>
            All
          </button>
          {categories.slice(0, 20).map(([c]) => (
            <button key={c} type="button" className={`ra-mp-chip ${cat === c ? 'ra-on' : ''}`} onClick={() => setCat(c)}>
              {humanizeCategory(c)}
            </button>
          ))}
          {categories.length > 20 && <span className="ra-mute" style={{ fontSize: 11 }}>+ more in dropdown</span>}
        </div>
        <div className="ra-mp-grid" style={{ marginTop: 4 }}>
          {slice.map((s) => (
            <SkillCard key={s.id} s={s} />
          ))}
        </div>
        {filtered.length === 0 && <p className="ra-mute">No skills match. Clear search or pick another category.</p>}
        {pageCount > 1 && (
          <div className="ra-mp-pager">
            <button type="button" disabled={currentPage === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              Previous
            </button>
            <span>
              Page {currentPage + 1} of {pageCount} ({PAGE_SIZE} per page)
            </span>
            <button
              type="button"
              disabled={currentPage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function SkillCard({ s }: { s: ClaudeSkillCatalogEntry }): ReactNode {
  const { short, hasMore } = splitDesc(s.description)

  return (
    <article className="ra-mp-card">
      <span className="ra-mp-card-badg">{humanizeCategory(s.category)}</span>
      <h3>{s.title}</h3>
      <code className="ra-mp-slug">{s.id}</code>
      <p className="ra-mp-desc" title={hasMore ? s.description : undefined}>
        {short}
      </p>
      {s.tags && s.tags.length > 0 && (
        <p className="ra-mute" style={{ fontSize: 10, margin: 0, lineHeight: 1.3 }}>
          {s.tags.slice(0, 4).join(' · ')}
        </p>
      )}
      <div className="ra-mp-actions">
        <a className="ra-mp-link" href={s.sourceUrl} target="_blank" rel="noreferrer">
          View on GitHub
        </a>
        <a className="ra-mp-link" href={s.rawUrl} target="_blank" rel="noreferrer" title="Raw SKILL.md (install / reference)">
          Raw
        </a>
        <button
          type="button"
          className="ra-mp-link"
          onClick={() => {
            void navigator.clipboard.writeText(`/read ${s.relativePath}`)
          }}
        >
          Copy /read
        </button>
      </div>
    </article>
  )
}
