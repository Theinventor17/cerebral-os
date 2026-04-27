import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path, { join } from 'node:path'
import { writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { EmotivCortexClient } from './cortex-client'
import { openResonantDatabase } from './db-ra'
import { localChatCompletions, testLLM, type ChatMsg } from './local-llm'
import { clearSecretKey, getSecretKey, loadAllSecrets, setSecretKey } from './secureStore'
import { registerResonantIpc } from './ra-handlers'
import { registerCerebralIpc } from './cerebral-handlers'
import { registerCerebralCommandIpc } from './cerebral-command-executor'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
let mainWindow: BrowserWindow | null = null
let dbRef: ReturnType<typeof openResonantDatabase> | null = null
let cortex: EmotivCortexClient | null = null
let cortexWssUrl = 'wss://localhost:6868'

const LOG_PATH = () => join(app.getPath('userData'), 'cerbral_os_debug.log')

function logToFile(msg: string): void {
  try {
    const d = app.getPath('userData')
    if (!existsSync(d)) {
      mkdirSync(d, { recursive: true })
    }
    const line = `${new Date().toISOString()} ${msg}\n`
    writeFileSync(LOG_PATH(), line, { flag: 'a' })
  } catch {
    // ignore
  }
}

function appLog(m: string): void {
  logToFile(m)
  try {
    // EPIPE: stdout may be closed (packaged app, no TTY) — do not let this crash the process.
    // eslint-disable-next-line no-console
    console.log(m)
  } catch {
    // ignore
  }
  try {
    mainWindow?.webContents?.send('ra:log', m)
  } catch {
    // ignore (window closed)
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    title: 'CEREBRAL OS',
    width: 1536,
    height: 864,
    minWidth: 1280,
    minHeight: 720,
    show: true,
    backgroundColor: '#000000',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      webviewTag: true
    }
  })
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('cerebral:window:state', { maximized: true })
  })
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('cerebral:window:state', { maximized: false })
  })
  // electron-vite sets this in `npm run dev` (not Vite's VITE_DEV_SERVER_URL).
  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (devUrl) {
    void mainWindow.loadURL(devUrl)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
}

function broadcastCortex(payload: unknown): void {
  mainWindow?.webContents.send('cortex:push', payload)
}

function ensureCortex(): EmotivCortexClient {
  if (!cortex) {
    cortex = new EmotivCortexClient({
      url: cortexWssUrl,
      onLog: (m) => appLog(`[Cortex] ${m}`)
    })
    cortex.on('cortex', (ev: { type: string; stream?: string; data?: unknown }) => {
      broadcastCortex(ev)
    })
    cortex.on('disconnected', () => {
      broadcastCortex({ type: 'disconnected' })
    })
  }
  return cortex
}

function registerIpc(): void {
  ipcMain.handle('ra:paths', () => ({
    userData: app.getPath('userData')
  }))

  ipcMain.handle('ra:secrets:load', () => loadAllSecrets())
  ipcMain.handle('ra:secrets:get', (_e, k: string) => getSecretKey(k))
  ipcMain.handle('ra:secrets:set', (_e, k: string, v: string) => {
    setSecretKey(k, v)
  })
  ipcMain.handle('ra:secrets:clear', (_e, k: string) => {
    clearSecretKey(k)
  })

  ipcMain.handle('cortex:configure', (_e, a: { url?: string }) => {
    if (a?.url && typeof a.url === 'string' && a.url.length > 0) {
      cortexWssUrl = a.url
    }
    if (cortex) {
      cortex.removeAllListeners()
      cortex.closeSocket()
      cortex = null
    }
    return { ok: true, url: cortexWssUrl }
  })

  ipcMain.handle('cortex:connect', async () => {
    const c = ensureCortex()
    if (c.connected) {
      return { ok: true }
    }
    try {
      await c.connectToCortex()
      return { ok: true }
    } catch (e) {
      const err = e as Error
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('cortex:requestAccess', async () => {
    const c = ensureCortex()
    return c.requestAccess()
  })

  ipcMain.handle('cortex:authorize', async (_e, clientId: string, clientSecret: string, license?: string) => {
    const c = ensureCortex()
    return c.authorize(clientId, clientSecret, license)
  })

  ipcMain.handle('cortex:queryHeadsets', async () => {
    const c = ensureCortex()
    if (!c.cortexToken) {
      throw new Error('Not authorized. Authorize with Cortex first.')
    }
    return c.queryHeadsets()
  })

  ipcMain.handle('cortex:controlDevice', async (_e, a: { command: 'connect' | 'disconnect'; headset: string }) => {
    const c = ensureCortex()
    return c.controlDevice(a)
  })

  ipcMain.handle('cortex:createSession', async (_e, headset: string) => {
    const c = ensureCortex()
    return c.createSession(headset)
  })

  ipcMain.handle('cortex:subscribe', async (_e, streams: string[], sessionId?: string) => {
    const c = ensureCortex()
    return c.subscribeToStreams(streams, sessionId)
  })

  ipcMain.handle('cortex:unsubscribe', async (_e, streams: string[], sessionId?: string) => {
    const c = ensureCortex()
    return c.unsubscribeFromStreams(streams, sessionId)
  })

  ipcMain.handle('cortex:closeSession', async () => {
    const c = ensureCortex()
    return c.closeSession()
  })

  ipcMain.handle('cortex:disconnect', async () => {
    if (cortex) {
      cortex.removeAllListeners()
      cortex.closeSocket()
      cortex = null
    }
    return { ok: true }
  })

  ipcMain.handle('cortex:state', () => {
    if (!cortex) {
      return { connected: false, token: false, session: null, headset: null }
    }
    return {
      connected: cortex.connected,
      token: !!cortex.cortexToken,
      session: cortex.sessionId,
      headset: cortex.headsetId
    }
  })

  ipcMain.handle('cortex:test', async (_e, url?: string) => {
    try {
      if (typeof url === 'string' && url.length > 0) {
        cortexWssUrl = url
        if (cortex) {
          cortex.removeAllListeners()
          cortex.closeSocket()
          cortex = null
        }
      }
      const c = ensureCortex()
      if (!c.connected) {
        await c.connectToCortex()
      }
      return { ok: true, connected: c.connected, hasToken: !!c.cortexToken }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(
    'cortex:insightTest',
    async (
      _e,
      a: { url?: string; clientId: string; clientSecret: string; headsetId: string; streams: string[] }
    ) => {
      try {
        if (a?.url && typeof a.url === 'string' && a.url.length > 0) {
          cortexWssUrl = a.url
          if (cortex) {
            cortex.removeAllListeners()
            cortex.closeSocket()
            cortex = null
          }
        }
        const c = ensureCortex()
        if (!c.connected) {
          await c.connectToCortex()
        }
        await c.authorize(a.clientId, a.clientSecret, '')
        const headsets = await c.queryHeadsets()
        if (a.headsetId) {
          try {
            await c.controlDevice({ command: 'connect', headset: a.headsetId })
          } catch (err) {
            appLog(`[Cortex] controlDevice: ${(err as Error).message}`)
          }
        }
        const sid = await c.createSession(a.headsetId)
        if (a.streams?.length) {
          await c.subscribeToStreams(a.streams, sid)
        }
        return { ok: true as const, sessionId: sid, headsets }
      } catch (e) {
        return { ok: false as const, error: (e as Error).message }
      }
    }
  )

  ipcMain.handle(
    'llm:chat',
    async (
      _e,
      a: { url: string; model: string; messages: Array<{ role: string; content: string }>; temperature?: number; max_tokens?: number }
    ) => {
      return localChatCompletions(
        a.url,
        a.model,
        a.messages as ChatMsg[],
        (m) => appLog(m),
        { temperature: a.temperature, max_tokens: a.max_tokens }
      )
    }
  )

  ipcMain.handle('llm:test', async (_e, a: { url: string; model: string }) => {
    return testLLM(a.url, a.model, (m) => appLog(m))
  })

  /** Folder pickers must use the focused BrowserWindow on Windows or the dialog may not appear or may open behind. */
  ipcMain.handle('cerebral:dialog:pickDirectory', async () => {
    const win = mainWindow
    win?.focus()
    const opts = {
      title: 'Open project folder',
      properties: ['openDirectory', 'createDirectory'] as Array<'openDirectory' | 'createDirectory'>
    }
    const { canceled, filePaths } = win
      ? await dialog.showOpenDialog(win, opts)
      : await dialog.showOpenDialog(opts)
    if (canceled || !filePaths[0]) {
      return { path: null as string | null }
    }
    return { path: filePaths[0] }
  })

  ipcMain.handle('cerebral:dialog:pickDirectoryParent', async () => {
    const win = mainWindow
    win?.focus()
    const opts = {
      title: 'Choose parent folder for clone',
      properties: ['openDirectory', 'createDirectory'] as Array<'openDirectory' | 'createDirectory'>
    }
    const { canceled, filePaths } = win
      ? await dialog.showOpenDialog(win, opts)
      : await dialog.showOpenDialog(opts)
    if (canceled || !filePaths[0]) {
      return { path: null as string | null }
    }
    return { path: filePaths[0] }
  })

  /** Single file in the project; renderer maps to a workspace-relative path. */
  ipcMain.handle('cerebral:dialog:pickFile', async () => {
    const win = mainWindow
    win?.focus()
    const opts = {
      title: 'Open file',
      properties: ['openFile'] as Array<'openFile'>,
      filters: [
        { name: 'Code & text', extensions: ['txt', 'md', 'html', 'htm', 'css', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'json', 'yml', 'yaml', 'xml', 'svg', 'vue', 'svelte', 'rs', 'go', 'py'] },
        { name: 'All', extensions: ['*'] }
      ]
    }
    const { canceled, filePaths } = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    if (canceled || !filePaths[0]) {
      return { path: null as string | null }
    }
    return { path: filePaths[0] }
  })

  ipcMain.handle('cerebral:window:toggleDevtools', (e) => {
    const w = BrowserWindow.fromWebContents(e.sender)
    w?.webContents.toggleDevTools()
    return { ok: true as const }
  })

  ipcMain.handle('cerebral:window:getState', (e) => {
    const w = BrowserWindow.fromWebContents(e.sender)
    if (!w) {
      return { ok: false as const }
    }
    return { ok: true as const, maximized: w.isMaximized() }
  })

  ipcMain.handle('cerebral:window:minimize', (e) => {
    BrowserWindow.fromWebContents(e.sender)?.minimize()
    return { ok: true as const }
  })

  ipcMain.handle('cerebral:window:maximizeToggle', (e) => {
    const w = BrowserWindow.fromWebContents(e.sender)
    if (!w) {
      return { ok: false as const, maximized: false }
    }
    if (w.isMaximized()) {
      w.unmaximize()
    } else {
      w.maximize()
    }
    return { ok: true as const, maximized: w.isMaximized() }
  })

  ipcMain.handle('cerebral:window:close', (e) => {
    BrowserWindow.fromWebContents(e.sender)?.close()
    return { ok: true as const }
  })

  ipcMain.handle('cerebral:app:quit', () => {
    app.quit()
    return { ok: true as const }
  })

  ipcMain.handle('cerebral:app:about', () => ({
    name: 'CEREBRAL OS',
    version: app.getVersion()
  }))

  ipcMain.handle('cerebral:shell:openExternal', async (_e, url: string) => {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return { ok: false as const, error: 'Invalid URL' }
    }
    await shell.openExternal(url)
    return { ok: true as const }
  })
}

app.whenReady().then(() => {
  dbRef = openResonantDatabase()
  appLog('CEREBRAL OS database at ' + dbRef.path)
  registerIpc()
  createWindow()
  if (dbRef) {
    registerResonantIpc(dbRef.db, appLog)
    registerCerebralIpc(dbRef.db, appLog, (ch, p) => {
      mainWindow?.webContents?.send(ch, p)
    })
    registerCerebralCommandIpc(() => {
      if (!dbRef) {
        throw new Error('Database is not available')
      }
      return dbRef.db
    }, appLog)
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
