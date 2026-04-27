import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { AGENT_MARKETPLACE_TEMPLATES } from '@/agents/defaultTemplates'
import claudeBundle from '@/data/claudeSkillsCatalog.json'
import type { ClaudeSkillCatalogEntry, ClaudeSkillsCatalog } from '@/types/claudeSkills'
import type { ComposerWorkflowMode } from '@/types'
import {
  getImportedIdsForWorkflow,
  importSkillForWorkflow,
  isSkillImportedForWorkflow,
  loadWorkflowSkillImports,
  removeSkillFromWorkflow
} from '../skill/workflowSkillImports'
import {
  categoriesWithCount,
  filterCatalogSkills,
  humanizeCategory,
  SKILL_KEYWORD_PRESETS,
  sortCatalogSkills,
  type SortMode
} from '../skill/skillCatalogQuery'

const catalog = claudeBundle as ClaudeSkillsCatalog
const PAGE_SIZE = 24

const MODES: { id: ComposerWorkflowMode; label: string; hint: string }[] = [
  { id: 'vibe', label: 'Vibe', hint: 'coding & implementation' },
  { id: 'imagine', label: 'Imagine', hint: 'create & mix' },
  { id: 'execute', label: 'Execute', hint: 'actions & getting things done' }
]

function splitDesc(desc: string, max = 300): { short: string; hasMore: boolean } {
  if (desc.length <= max) {
    return { short: desc, hasMore: false }
  }
  return { short: desc.slice(0, max).trim() + '…', hasMore: true }
}

export function CerebralSkillMarketplace(): ReactNode {
  const { skills, generatedAt, count, upstream: REPO } = catalog
  const [targetMode, setTargetMode] = useState<ComposerWorkflowMode>('vibe')
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>('')
  const [sort, setSort] = useState<SortMode>('title')
  const [page, setPage] = useState(0)
  const [, setTick] = useState(0)

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  const categories = useMemo(() => categoriesWithCount(skills), [skills])

  const filtered = useMemo(() => {
    const f = filterCatalogSkills(skills, { q, category: cat })
    return sortCatalogSkills(f, sort)
  }, [skills, q, cat, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const slice = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
  const imported = loadWorkflowSkillImports()

  return (
    <div className="ra-screen ra-mp cos-mp">
      <div className="ra-mp-hero">
        <h1 className="ra-h1">Skill marketplace</h1>
        <p className="ra-mute" style={{ maxWidth: 760, lineHeight: 1.45 }}>
          Full <strong style={{ color: 'var(--text-primary)' }}>{count}+</strong> skill catalog (same library as before) from{' '}
          <a href={REPO} target="_blank" rel="noreferrer" style={{ color: 'var(--cyan)' }}>
            alirezarezvani/claude-skills
          </a>
          . Pick a <strong>Composer mode</strong> (matches Vibe / Imagine / Execute in chat), then <strong>Import</strong> to attach
          that skill&rsquo;s summary to the model when you use that mode. Instructions are steered into the system prompt;
          tools are not run automatically.
        </p>
        <div className="cos-mp-modes" role="tablist" aria-label="Target Composer mode" style={{ marginTop: 12 }}>
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              className={targetMode === m.id ? 'cos-mp-mode cos-mp-mode-on' : 'cos-mp-mode'}
              onClick={() => {
                setTargetMode(m.id)
                setPage(0)
              }}
            >
              <span className="cos-mp-mode-lab">{m.label}</span>
              <span className="cos-mp-mode-hint">{m.hint}</span>
              <span className="cos-mp-mode-n">{imported[m.id].length} linked</span>
            </button>
          ))}
        </div>
        <p className="ra-mp-meta">
          Catalog {new Date(generatedAt).toLocaleString()} · {filtered.length} {filtered.length === 1 ? 'skill' : 'skills'}
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
              <p className="ra-mute" style={{ fontSize: 10, margin: '6px 0 0' }}>
                Create an agent from Agent profiles — template wiring in a follow-up.
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="ra-mp-section">
        <h2>Claude skills library</h2>
        <div className="ra-mp-toolbar" style={{ flexWrap: 'wrap' }}>
          <input
            className="ra-mp-search"
            type="search"
            placeholder="Keywords (space = AND) — e.g. board test · title, path, description…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(0)
            }}
            autoComplete="off"
            aria-label="Search skills by keyword"
            style={{ minWidth: 'min(100%, 320px)', flex: '1 1 220px' }}
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
          <select
            className="ra-mp-select"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as SortMode)
              setPage(0)
            }}
            aria-label="Sort list"
          >
            <option value="title">Sort: name A–Z</option>
            <option value="category">Sort: by category</option>
          </select>
          <span className="ra-mp-count">
            {filtered.length} skills · {categories.length} categories
          </span>
        </div>
        <div className="ra-mp-presets" role="group" aria-label="Quick search by type of work">
          <span className="ra-mp-presets-lab" title="Adds a keyword; combine with space-separated AND search">
            Quick tasks
          </span>
          {SKILL_KEYWORD_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className="ra-mp-preset"
              title={p.title ?? p.q}
              onClick={() => {
                setQ((prev) => (prev.trim() ? `${prev} ${p.q}`.trim() : p.q))
                setPage(0)
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="ra-mp-cats" aria-label="Category shortcuts" style={{ maxHeight: 120, overflowY: 'auto' }}>
          <button type="button" className={`ra-mp-chip ${cat === '' ? 'ra-on' : ''}`} onClick={() => setCat('')}>
            All
          </button>
          {categories.map(([c]) => (
            <button key={c} type="button" className={`ra-mp-chip ${cat === c ? 'ra-on' : ''}`} onClick={() => setCat(c)}>
              {humanizeCategory(c)}
            </button>
          ))}
        </div>
        <div className="ra-mp-grid" style={{ marginTop: 4 }}>
          {slice.map((s) => (
            <SkillCard key={s.id} s={s} wf={targetMode} onChanged={refresh} />
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
        <p className="ra-mute" style={{ fontSize: 10, marginTop: 12, maxWidth: 720 }}>
          Linked for <strong>{MODES.find((m) => m.id === targetMode)?.label}</strong>: {getImportedIdsForWorkflow(targetMode).length}{' '}
          (shown in the Skills sidebar). Switch mode above to add different sets per Vibe / Imagine / Execute.
        </p>
      </div>
    </div>
  )
}

function SkillCard({
  s,
  wf,
  onChanged
}: {
  s: ClaudeSkillCatalogEntry
  wf: ComposerWorkflowMode
  onChanged: () => void
}): ReactNode {
  const { short, hasMore } = splitDesc(s.description)
  const isOn = isSkillImportedForWorkflow(wf, s.id)

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
      <div className="ra-mp-actions" style={{ flexWrap: 'wrap' }}>
        {isOn ? (
          <button
            type="button"
            className="ra-btn ra-btn-sm"
            onClick={() => {
              removeSkillFromWorkflow(wf, s.id)
              onChanged()
            }}
          >
            Unlink
          </button>
        ) : (
          <button
            type="button"
            className="ra-btn ra-btn-sm ra-btn-primary"
            onClick={() => {
              importSkillForWorkflow(wf, s.id)
              onChanged()
            }}
          >
            Import for mode
          </button>
        )}
        <a className="ra-mp-link" href={s.sourceUrl} target="_blank" rel="noreferrer">
          GitHub
        </a>
        <a className="ra-mp-link" href={s.rawUrl} target="_blank" rel="noreferrer" title="SKILL.md">
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
