import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { takeFirstLineClosedFence } from '../src/utils/markdownFences'

const extMap: Record<string, string> = {
  html: '.html',
  htm: '.htm',
  css: '.css',
  js: '.js',
  mjs: '.mjs',
  cjs: '.cjs',
  ts: '.ts',
  tsx: '.tsx',
  jsx: '.jsx',
  json: '.json',
  md: '.md',
  mdx: '.mdx',
  py: '.py',
  rs: '.rs',
  go: '.go',
  sh: '.sh',
  bash: '.sh',
  zsh: '.zsh',
  ps1: '.ps1',
  sql: '.sql',
  yaml: '.yml',
  yml: '.yml',
  xml: '.xml',
  toml: '.toml',
  ini: '.ini',
  env: '.env',
  dockerfile: '.dockerfile',
  txt: '.txt',
  'c++': '.cpp',
  cpp: '.cpp',
  c: '.c',
  java: '.java',
  cs: '.cs',
  diff: '.diff',
  patch: '.patch',
  svg: '.svg',
  vue: '.vue',
  svelte: '.svelte'
}

function langToExt(lang: string): string {
  const l = lang.toLowerCase().split(/[^a-z0-9+.#]/)[0] ?? 'txt'
  if (l.startsWith('.')) {
    return l
  }
  return extMap[l] ?? `.${l.slice(0, 10)}`
}

/**
 * Fenced blocks that only carry `<cerebral_actions>` (or tool JSON) are not project files; exporting them
 * creates spurious `cerebral-*.txt` under `.cerebral/exports` and shows a misleading "exporting…" state.
 * `runComposerToolBlock` still parses the same text after the stream and runs tools.
 */
function isComposerToolPayloadFence(code: string): boolean {
  const c = code.replace(/\r\n/g, '\n')
  if (/<cerebral_actions\b/i.test(c) || /<\/cerebral_actions>/i.test(c)) {
    return true
  }
  const t = c.trim()
  if (
    t.startsWith('{') &&
    /"actions"\s*:\s*\[/.test(t) &&
    /"type"\s*:\s*"(?:write_file|read_file|run_command)"/.test(t)
  ) {
    return true
  }
  return false
}

/**
 * While the assistant stream arrives, detect completed markdown code fences
 * and write them under `outDir` (mkdir -p). Returns absolute paths of files written.
 */
export class CodeFenceFileWriter {
  private buf = ''
  private counter = 0
  private readonly outDir: string

  constructor(workspaceRoot: string, sessionId: string) {
    this.outDir = join(workspaceRoot, '.cerebral', 'exports', sessionId.replace(/[^a-z0-9_-]/gi, '_'))
    mkdirSync(this.outDir, { recursive: true })
  }

  push(delta: string): string[] {
    this.buf += delta
    const written: string[] = []
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const open = this.buf.indexOf('```')
      if (open === -1) {
        break
      }
      const t = takeFirstLineClosedFence(this.buf.slice(open))
      if (!t) {
        break
      }
      this.buf = this.buf.slice(0, open) + t.rest
      if (isComposerToolPayloadFence(t.code)) {
        continue
      }
      this.counter += 1
      const langRaw = t.langLine.trim() || 'txt'
      const lang = langRaw.split(/\s+/)[0] ?? 'txt'
      const ext = langToExt(lang)
      const safe = langRaw.replace(/[^a-z0-9_-]/gi, '').slice(0, 32) || 'code'
      const name = `cerebral-${Date.now()}-${this.counter}-${safe}${ext}`
      const fpath = join(this.outDir, name)
      try {
        const body = t.code.replace(/\r\n/g, '\n').replace(/\n$/, '') + '\n'
        writeFileSync(fpath, body, 'utf8')
        written.push(fpath)
      } catch {
        // ignore I/O errors; chat still works
      }
    }
    if (this.buf.length > 1_500_000) {
      this.buf = this.buf.slice(-800_000)
    }
    return written
  }
}
