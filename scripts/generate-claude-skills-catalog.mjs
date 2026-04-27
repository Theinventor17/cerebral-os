/**
 * Scans a local clone of alirezarezvani/claude-skills and emits app/src/data/claudeSkillsCatalog.json
 *
 * Setup:  git clone --depth 1 https://github.com/alirezarezvani/claude-skills.git third_party/claude-skills
 * Run:    node scripts/generate-claude-skills-catalog.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const REPO = path.join(ROOT, 'third_party', 'claude-skills')
const OUT = path.join(ROOT, 'app', 'src', 'data', 'claudeSkillsCatalog.json')
const GITHUB = 'https://github.com/alirezarezvani/claude-skills'
const BLOB = `${GITHUB}/blob/main`
const RAW = 'https://raw.githubusercontent.com/alirezarezvani/claude-skills/main'

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) {
    return acc
  }
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (f.name.startsWith('.')) continue
    const p = path.join(dir, f.name)
    if (f.isDirectory()) walk(p, acc)
    else if (f.name === 'SKILL.md') acc.push(p)
  }
  return acc
}

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!m) return { raw: text, name: '', description: '', tags: [] }
  const block = m[1]
  let name = ''
  let description = ''
  const tags = []
  for (const line of block.split('\n')) {
    const n = line.match(/^name:\s*["']?([^"'\n]+)["']?/)
    if (n) {
      name = n[1].trim()
    }
    const d = line.match(/^description:\s*(.*)$/)
    if (d) {
      let rest = d[1].trim()
      if (rest.startsWith('"') && rest.endsWith('"')) {
        description = rest.slice(1, -1)
      } else {
        description = rest.replace(/^["']|["']$/g, '')
      }
    }
    if (line.trim().startsWith('- ') && /tags?:/.test(block.slice(0, block.indexOf(line)))) {
      /* handled below */ void 0
    }
  }
  const tagSec = block.match(/tags?:\s*\n((?:[ \t]*-[^\n]+\n?)+)/)
  if (tagSec) {
    for (const l of tagSec[1].split('\n')) {
      const t = l.match(/-\s*["']?([^"'\n]+)/)
      if (t) tags.push(t[1].trim())
    }
  }
  return { raw: text, name, description, tags }
}

function firstHeading(text) {
  const m = text.match(/^#[^#].*$/m)
  return m ? m[0].replace(/^#\s*/, '').trim() : ''
}

function main() {
  if (!fs.existsSync(REPO)) {
    console.error('Missing clone at', REPO)
    console.error('Run:  git clone --depth 1 https://github.com/alirezarezvani/claude-skills.git third_party/claude-skills')
    process.exit(1)
  }
  const all = walk(REPO)
  const entries = []
  for (const abs of all) {
    const rel = path.relative(REPO, abs).replace(/\\/g, '/')
    const parts = rel.split('/')
    if (parts.length === 2) {
      // category/SKILL.md — bundle index, not a leaf skill
      continue
    }
    const text = fs.readFileSync(abs, 'utf-8')
    const { name, description, tags } = parseFrontmatter(text)
    if (!name && !description) continue
    const relDir = rel.replace(/\/SKILL\.md$/, '')
    const segs = relDir.split('/')
    const category = segs[0] ?? 'general'
    const slug = segs[segs.length - 1] ?? name
    const title = firstHeading(text) || name || slug
    const id = relDir
    entries.push({
      id,
      category,
      slug,
      name: name || slug,
      title,
      description: (description || '').slice(0, 2000),
      tags,
      relativePath: rel,
      sourceUrl: `${BLOB}/${relDir}/SKILL.md`,
      rawUrl: `${RAW}/${relDir}/SKILL.md`
    })
  }
  entries.sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title))
  const payload = {
    generatedAt: new Date().toISOString(),
    upstream: GITHUB,
    count: entries.length,
    skills: entries
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 0), 'utf-8')
  console.log('Wrote', entries.length, 'skills to', path.relative(ROOT, OUT))
}

main()
