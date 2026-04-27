import { app, safeStorage } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

const SECRETS = 'cerbral_secrets_v1.json'
const ENCRYPT = 'cerbral_secrets_v1.enc'

function secretsDir(): string {
  return join(app.getPath('userData'), 'security')
}

function readLegacyPlain(): Record<string, string> {
  const p = join(secretsDir(), SECRETS)
  if (existsSync(p)) {
    try {
      return JSON.parse(readFileSync(p, 'utf-8')) as Record<string, string>
    } catch {
      return {}
    }
  }
  return {}
}

function getMachineKey(): Buffer {
  const s = scryptSync(app.getName() + 'cerbral' + app.getPath('userData').slice(-32), 'salt-cerbral', 32) as unknown as Buffer
  return s
}

function readEncryptedFile(): Buffer | null {
  const p = join(secretsDir(), ENCRYPT)
  if (!existsSync(p)) {
    return null
  }
  return readFileSync(p)
}

export function loadAllSecrets(): Record<string, string> {
  if (safeStorage.isEncryptionAvailable()) {
    const raw = readEncryptedFile()
    if (raw) {
      const json = safeStorage.decryptString(raw) as string
      try {
        return JSON.parse(json) as Record<string, string>
      } catch {
        return {}
      }
    }
  }
  const key = getMachineKey()
  const path = join(secretsDir(), ENCRYPT)
  if (existsSync(path) && !safeStorage.isEncryptionAvailable()) {
    try {
      const combined = readFileSync(path)
      const iv = combined.subarray(0, 16)
      const enc = combined.subarray(16)
      const d = createDecipheriv('aes-256-cbc', key, iv)
      const out = Buffer.concat([d.update(enc as unknown as Uint8Array) as unknown as Buffer, d.final() as unknown as Buffer])
      return JSON.parse(out.toString('utf-8')) as Record<string, string>
    } catch {
      return readLegacyPlain()
    }
  }
  return readLegacyPlain()
}

export function saveAllSecrets(data: Record<string, string>): void {
  if (safeStorage.isEncryptionAvailable()) {
    if (!existsSync(secretsDir())) {
      mkdirSync(secretsDir(), { recursive: true })
    }
    const buf = safeStorage.encryptString(JSON.stringify(data))
    writeFileSync(join(secretsDir(), ENCRYPT), buf)
    return
  }
  const key = getMachineKey()
  const iv = randomBytes(16)
  const c = createCipheriv('aes-256-cbc', key, iv)
  const out = Buffer.concat([iv, c.update(JSON.stringify(data), 'utf-8') as unknown as Buffer, c.final() as unknown as Buffer])
  if (!existsSync(secretsDir())) {
    mkdirSync(secretsDir(), { recursive: true })
  }
  writeFileSync(join(secretsDir(), ENCRYPT), out)
}

export function getSecretKey(key: string): string | undefined {
  return loadAllSecrets()[key]
}

export function setSecretKey(key: string, value: string): void {
  const all = { ...loadAllSecrets(), [key]: value }
  saveAllSecrets(all)
}

export function clearSecretKey(key: string): void {
  const all = loadAllSecrets()
  delete all[key]
  saveAllSecrets(all)
}
