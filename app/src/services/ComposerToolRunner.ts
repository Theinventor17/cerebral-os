import { allLineClosedFences } from '@/utils/markdownFences'
import {
  stripCerebralActionRegions,
  tryParseCerebralWorkspaceActions,
  tryParseJsonFenceWorkspaceActions
} from '@/cerebral/workspace/WorkspaceActionParser'
import { WORKSPACE_PROPOSAL_FOOTER } from '@/cerebral/workspace/WorkspaceService'
import type { WorkspaceAction } from '@/cerebral/workspace/WorkspaceTypes'

const WRITABLE_LANG = new Set([
  'html',
  'htm',
  'css',
  'scss',
  'sass',
  'less',
  'js',
  'javascript',
  'mjs',
  'cjs',
  'ts',
  'tsx',
  'jsx',
  'json',
  'md',
  'markdown',
  'py',
  'rs',
  'go',
  'xml',
  'svg',
  'vue',
  'svelte'
])

function extractPathFromBefore(before: string): string | null {
  const tick = /`([a-zA-Z0-9][a-zA-Z0-9_./-]+\.(html|htm|css|scss|less|js|mjs|ts|tsx|jsx|json|md|py|rs|go|xml|vue|svelte))`/
  const m1 = before.match(tick)
  if (m1) {
    return m1[1].replace(/\\/g, '/')
  }
  const bold = /(?:\*\*|##?\s*)\s*([a-zA-Z0-9][a-zA-Z0-9_./-]+\.(html|htm|css|js|mjs|ts|tsx|json))/
  const m2 = before.match(bold)
  if (m2) {
    return m2[1].replace(/\\/g, '/')
  }
  return null
}

/** e.g. `dog-website` or "folder my-site" */
function extractProjectSubdir(assistantText: string): string {
  const head = assistantText.slice(0, 2_000)
  const pats = [
    /(?:create|make)\s+(?:a\s+)?(?:new\s+)?(?:folder|directory|project)\s*[`'"]([a-zA-Z][a-zA-Z0-9_-]{0,63})[`'"]/i,
    /e\.g\.\s*[`'"]([a-zA-Z][a-zA-Z0-9_-]{1,64})[`'"]/i,
    /(?:in|under|inside)\s+`([a-zA-Z][a-z0-9_-]*)\//,
    /`([a-zA-Z][a-z0-9_-]+)`\s+(?:and|or)\s+inside/
  ]
  for (const p of pats) {
    const m = head.match(p)
    if (m && m[1] && m[1].length < 64) {
      return m[1].replace(/\/$/, '')
    }
  }
  return 'project'
}

const NAMED_DEFAULTS: Record<string, string[]> = {
  html: ['index.html', 'index2.html', 'index3.html'],
  htm: ['index.htm'],
  css: ['style.css', 'styles.css', 'app.css'],
  scss: ['style.scss', 'main.scss'],
  js: ['script.js', 'app.js', 'main.js'],
  javascript: ['script.js', 'app.js'],
  ts: ['index.ts', 'app.ts', 'main.ts'],
  tsx: ['index.tsx', 'App.tsx'],
  json: ['package.json', 'config.json', 'app.json'],
  md: ['README.md', 'notes.md'],
  markdown: ['README.md', 'content.md'],
  py: ['main.py', 'app.py'],
  xml: ['data.xml', 'config.xml'],
  rs: ['main.rs', 'lib.rs'],
  go: ['main.go'],
  svg: ['image.svg', 'icon.svg'],
  vue: ['App.vue', 'Component.vue'],
  svelte: ['App.svelte']
}

function nextDefaultName(lang: string, useIndex: Map<string, number>): string {
  const l = (lang.toLowerCase() === 'javascript' ? 'js' : lang.toLowerCase()) || 'txt'
  const list = NAMED_DEFAULTS[l] ?? [`file.${l === 'htm' ? 'html' : l}`]
  const i = useIndex.get(l) ?? 0
  useIndex.set(l, i + 1)
  return list[Math.min(i, list.length - 1)]
}

type Fence = { lang: string; content: string; before: string }

/**
 * Many models use bare ``` with no language tag. Sniff common web/code shapes so we still persist them.
 */
function sniffFenceLang(content: string): string | null {
  const t = content.replace(/^\uFEFF/, '').trim()
  if (t.length < 2) {
    return null
  }
  const head = t.slice(0, 1_200)
  if (/^<!doctype\s+html/i.test(t) || /^<\s*html[\s>]/i.test(t)) {
    return 'html'
  }
  if (/<!DOCTYPE|<html[\s>]/i.test(head) && /<(head|body|div|section|script|link|meta|title|h[1-6]|p|ul|form)\b/i.test(head)) {
    return 'html'
  }
  if (!/<!DOCTYPE|<html[\s>]/i.test(head)) {
    if (
      /^\s*@(?:import|media|layer|charset|keyframes|font-face|supports|container)/im.test(t) ||
      /^\s*(?:html|body|\*|:[a-z-]+|\.[a-zA-Z#]|#[a-fA-F0-9_\-]{1,4})\b[\s,]*[{,]/m.test(t) ||
      (/^\s*[.#][\w-]+\s*\{/.test(t) && /\{[^}]*\}/.test(t))
    ) {
      return 'css'
    }
  }
  if (
    /^\s*(?:import|export)\s+/.test(t) ||
    /^\s*(?:const|let|var|async\s+function|function|class|interface|type)\s+/m.test(t) ||
    /document\.(getElementById|querySelector|addEventListener)\b/.test(t) ||
    /^\s*\/\//m.test(t)
  ) {
    if (/\b(?:React|JSX|tsx)\b/i.test(t) || /<\s*[A-Z][A-Za-z0-9]*/.test(t)) {
      return 'tsx'
    }
    return 'js'
  }
  return null
}

function extractMarkdownFences(text: string): Fence[] {
  const out: Fence[] = []
  const blocks = allLineClosedFences(text)
  for (const b of blocks) {
    const tag = (b.langLine || '').trim().toLowerCase()
    let lang = (tag.split(/\s+/)[0] ?? '').trim()
    const content = b.content ?? ''
    if (content.length < 2) {
      continue
    }
    if (lang === 'diff' || lang === 'text' || lang === 'bash' || lang === 'sh' || lang === 'shell' || lang === 'powershell' || lang === 'ps1') {
      continue
    }
    if (!lang) {
      const s = sniffFenceLang(content)
      if (!s) {
        continue
      }
      lang = s
    } else if (!WRITABLE_LANG.has(lang)) {
      continue
    }
    const start = b.start
    const before = text.slice(Math.max(0, start - 500), start)
    out.push({ lang, content, before })
  }
  return out
}

/**
 * If the model skipped <cerebral_actions>, still save code fences to the workspace (multi-file sites, etc.).
 */
function buildInferredWriteActions(assistantText: string): { path: string; content: string }[] {
  const fences = extractMarkdownFences(assistantText)
  if (fences.length === 0) {
    return []
  }
  const allowSinglePage =
    fences.length === 1 &&
    fences[0]!.lang === 'html' &&
    (fences[0]!.content.length > 200 || /<!doctype|^\s*<html[\s>]/i.test(fences[0]!.content))
  if (fences.length < 2 && !allowSinglePage) {
    return []
  }
  const useIndex = new Map<string, number>()
  const sub = extractProjectSubdir(assistantText)
  const prefix = sub ? `${sub.replace(/\/$/, '')}/` : ''
  const writes: { path: string; content: string }[] = []
  for (const f of fences) {
    const lang = f.lang
    if (!lang || !WRITABLE_LANG.has(lang)) {
      continue
    }
    const l = lang === 'htm' ? 'html' : lang
    const fromHint = extractPathFromBefore(f.before)
    let rel: string
    if (fromHint) {
      const clean = fromHint.replace(/^\//, '')
      rel = !prefix || clean.startsWith(prefix) || clean.split('/').length > 1 ? fromHint : `${prefix}${clean}`
    } else {
      rel = prefix + nextDefaultName(l, useIndex)
    }
    const norm = rel.replace(/\\/g, '/').replace(/^\//, '')
    writes.push({ path: norm, content: f.content.replace(/\r\n/g, '\n') })
  }
  return dedupeByPath(writes)
}

function dedupeByPath(items: { path: string; content: string }[]): { path: string; content: string }[] {
  const m = new Map<string, { path: string; content: string }>()
  for (const it of items) {
    m.set(it.path, it)
  }
  return [...m.values()]
}

async function runWriteActions(
  items: { path: string; content: string }[],
  label: string
): Promise<{ lines: string[]; written: string[] }> {
  const lines: string[] = []
  const written: string[] = []
  for (const { path, content } of items) {
    const w = await window.cerebral.workspace.writeFile({ relativePath: path, content, workspaceId: 'default' })
    if (w.ok) {
      lines.push(`- **Wrote** \`${path}\` → \`${w.path}\` (${label})`)
      written.push(w.path)
    } else {
      lines.push(`- \`${path}\` failed: ${w.error}`)
    }
  }
  return { lines, written }
}

/**
 * Parse `cerebral_actions` (fence or tag). If present, return pending actions for user approval (no auto-exec).
 * Otherwise infer multi-file writes from code fences and execute those immediately (no destructive ops).
 */
export async function runComposerToolBlock(assistantText: string): Promise<{
  textForUser: string
  ranTools: boolean
  workspacePaths: string[]
  /** When set, the UI must get approval before calling workspace IPC. */
  pendingWorkspaceActions?: WorkspaceAction[]
}> {
  let proposed = tryParseCerebralWorkspaceActions(assistantText)
  if (!proposed || proposed.actions.length === 0) {
    proposed = tryParseJsonFenceWorkspaceActions(assistantText)
  }
  if (proposed && proposed.actions.length > 0) {
    const intro = proposed.narrative?.trim() || '_(The model proposed workspace actions.)_'
    return {
      textForUser: intro + WORKSPACE_PROPOSAL_FOOTER,
      ranTools: false,
      workspacePaths: [],
      pendingWorkspaceActions: proposed.actions
    }
  }

  const t = stripCerebralActionRegions(assistantText).trim() || assistantText
  const inferred = buildInferredWriteActions(t)
  if (inferred.length === 0) {
    return { textForUser: assistantText, ranTools: false, workspacePaths: [] }
  }

  const { lines, written } = await runWriteActions(inferred, 'from markdown fences')
  const block = [
    '',
    '---',
    '**Saved to workspace (auto-detected from your code blocks):**',
    '*(Wrote **immediately** — no Approve step for this mode. The **Proposed changes** panel only appears if the model sends a `cerebral_actions` (or a `json` fence) *action list*; plain HTML/CSS/JS code blocks are auto-saved. The **Review** control near the input is for Composer’s own diff, not these workspace writes.)*',
    ...lines
  ].join('\n')
  return { textForUser: (t + block).trim(), ranTools: true, workspacePaths: written }
}
