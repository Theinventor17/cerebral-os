/**
 * Key/value store backed by encrypted local files in the main process.
 * EMOTIV and API keys never touch plain logs.
 */
export class SecureStorageService {
  async get(key: string): Promise<string | undefined> {
    return window.ra.secrets.get(key)
  }

  async set(key: string, value: string): Promise<void> {
    await window.ra.secrets.set(key, value)
  }

  async loadAll(): Promise<Record<string, string>> {
    return window.ra.secrets.load()
  }

  async clear(key: string): Promise<void> {
    await window.ra.secrets.clear(key)
  }
}

export const secureStorage = new SecureStorageService()
