import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

export type CerebralCommandRunPayload = {
  entryId: string
  sentence: string
  source: 'manual' | 'thought' | 'hybrid'
  approved: boolean
  typedConfirm?: string
  sessionId?: string | null
}

export type CerebralCommandRunResult = Promise<{
  ok: boolean
  output?: string
  error?: string
  status?: string
}>

const ra = {
  paths: () => ipcRenderer.invoke('ra:paths') as Promise<{ userData: string }>,
  init: () => ipcRenderer.invoke('ra:init') as Promise<{ ok: boolean }>,
  settings: {
    get: () =>
      ipcRenderer.invoke('ra:settings') as Promise<{
        localOnly: boolean
        showReasoningStream: boolean
        autoListen: boolean
        sessionMode: 'manual' | 'hybrid' | 'thought' | null
        demoMode: boolean
        guideProviderId: string | null
        cortexUrl: string
        emotivHeadsetId: string
        emotivStreams: string[]
      }>,
    set: (p: {
      localOnly?: boolean
      showReasoningStream?: boolean
      autoListen?: boolean
      sessionMode?: 'manual' | 'hybrid' | 'thought' | null
      demoMode?: boolean
      guideProviderId?: string | null
      cortexUrl?: string
      emotivHeadsetId?: string
      emotivStreams?: string[]
    }) => ipcRenderer.invoke('ra:settings:set', p) as Promise<void>
  },
  insightCalibration: {
    insert: (r: {
      id: string
      command_key: string
      calibration_run_id: string
      round_index: number
      phase: string
      sample_json: string
      created_at: string
    }) => ipcRenderer.invoke('ra:insight:calibration:insert', r) as Promise<void>,
    list: (commandKey?: string) => ipcRenderer.invoke('ra:insight:calibration:list', commandKey) as Promise<unknown[]>
  },
  encyclopedia: {
    list: () => ipcRenderer.invoke('ra:encyclopedia:list') as Promise<unknown[]>,
    count: () => ipcRenderer.invoke('ra:encyclopedia:count') as Promise<number>,
    bulkSeed: (rows: Array<Record<string, unknown>>) => ipcRenderer.invoke('ra:encyclopedia:bulkSeed', rows) as Promise<void>,
    setEnabled: (a: { id: string; enabled: boolean }) => ipcRenderer.invoke('ra:encyclopedia:setEnabled', a) as Promise<void>
  },
  neuralLog: {
    alphabet: (r: { id: string; session_id: string | null; token_json: string; created_at: string }) =>
      ipcRenderer.invoke('ra:neural:alphabet:insert', r) as Promise<void>,
    sentence: (r: { id: string; session_id: string | null; batch_id: string; candidate_json: string; created_at: string }) =>
      ipcRenderer.invoke('ra:neural:sentence:insert', r) as Promise<void>,
    selection: (r: { id: string; session_id: string | null; event_type: string; payload_json: string | null; created_at: string }) =>
      ipcRenderer.invoke('ra:neural:selection:insert', r) as Promise<void>
  },
  provider: {
    list: () => ipcRenderer.invoke('ra:provider:list') as Promise<unknown[]>,
    get: (id: string) => ipcRenderer.invoke('ra:provider:get', id) as Promise<Record<string, unknown> | null>,
    upsert: (row: Record<string, unknown>) => ipcRenderer.invoke('ra:provider:upsert', row) as Promise<void>,
    delete: (id: string) => ipcRenderer.invoke('ra:provider:delete', id) as Promise<void>,
    hasKey: (id: string) => ipcRenderer.invoke('ra:provider:hasKey', id) as Promise<boolean>,
    test: (id: string) =>
      ipcRenderer.invoke('ra:provider:test', { id }) as Promise<{
        ok: boolean
        error?: string
        modelName?: string
        sample?: string
        label?: string
        endpoint?: string
      }>,
    models: (id: string) =>
      ipcRenderer.invoke('ra:provider:models', id) as Promise<{
        ok: boolean
        error?: string
        defaultModel: string
        models: Array<{ id: string; name: string }>
      }>
  },
  agent: {
    list: () => ipcRenderer.invoke('ra:agent:list') as Promise<unknown[]>,
    get: (id: string) => ipcRenderer.invoke('ra:agent:get', id) as Promise<Record<string, unknown> | null>,
    upsert: (row: Record<string, unknown>) => ipcRenderer.invoke('ra:agent:upsert', row) as Promise<void>,
    delete: (id: string) => ipcRenderer.invoke('ra:agent:delete', id) as Promise<void>
  },
  session: {
    list: () => ipcRenderer.invoke('ra:session:list') as Promise<unknown[]>,
    get: (id: string) => ipcRenderer.invoke('ra:session:get', id) as Promise<Record<string, unknown> | null>,
    upsert: (row: Record<string, unknown>) => ipcRenderer.invoke('ra:session:upsert', row) as Promise<void>
  },
  message: {
    list: (sessionId: string) => ipcRenderer.invoke('ra:message:list', sessionId) as Promise<unknown[]>,
    insert: (row: Record<string, unknown>) => ipcRenderer.invoke('ra:message:insert', row) as Promise<void>,
    update: (r: {
      id: string
      content?: string
      status?: string
      stream_id?: string | null
      error_text?: string | null
    }) => ipcRenderer.invoke('ra:message:update', r) as Promise<void>
  },
  memory: {
    list: (agentId?: string) => ipcRenderer.invoke('ra:memory:list', agentId) as Promise<unknown[]>,
    insert: (row: Record<string, unknown>) => ipcRenderer.invoke('ra:memory:insert', row) as Promise<void>
  },
  swarm: {
    list: () => ipcRenderer.invoke('ra:swarm:list') as Promise<unknown[]>,
    upsert: (row: Record<string, unknown>) => ipcRenderer.invoke('ra:swarm:upsert', row) as Promise<void>,
    delete: (id: string) => ipcRenderer.invoke('ra:swarm:delete', id) as Promise<void>
  },
  swarmRun: {
    insert: (row: Record<string, unknown>) => ipcRenderer.invoke('ra:swarm:run:insert', row) as Promise<void>
  },
  thought: {
    list: (sessionId: string) => ipcRenderer.invoke('ra:thought:list', sessionId) as Promise<unknown[]>,
    upsert: (row: Record<string, unknown>) => ipcRenderer.invoke('ra:thought:upsert', row) as Promise<void>
  },
  toolApproval: {
    insert: (row: Record<string, unknown>) => ipcRenderer.invoke('ra:toolApproval:insert', row) as Promise<void>
  },
  chat: {
    complete: (a: {
      agentId: string
      userContent: string
      inputSource: string
      sessionId: string
      history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
      /** Steers reply style: coding vs creative vs action-first */
      workflowMode?: 'vibe' | 'imagine' | 'execute'
      /** Optional extra system text (e.g. imported skill summaries for this workflow) */
      skillAddendum?: string
    }) => ipcRenderer.invoke('ra:chat:complete', a) as Promise<string>,
    completeStream: (a: {
      streamId: string
      agentId: string
      userContent: string
      inputSource: string
      sessionId: string
      history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
      workflowMode?: 'vibe' | 'imagine' | 'execute'
      skillAddendum?: string
    }) =>
      ipcRenderer.invoke('ra:chat:stream', a) as Promise<{
        fullText: string
        savedFiles: string[]
        cancelled?: boolean
        chunkCount?: number
        usedNonStreamFallback?: boolean
      }>,
    cancelStream: (streamId: string) =>
      ipcRenderer.invoke('ai:chatStreamCancel', streamId) as Promise<{ ok: true }>,
    onChatStreamDelta: (cb: (p: { streamId: string; chunk: string }) => void) => {
      const fn = (_ev: IpcRendererEvent, p: { streamId: string; chunk: string }) => cb(p)
      ipcRenderer.on('ra:chat:stream:delta', fn)
      return () => ipcRenderer.removeListener('ra:chat:stream:delta', fn)
    },
    onChatStreamFile: (cb: (p: { streamId: string; path: string }) => void) => {
      const fn = (_ev: IpcRendererEvent, p: { streamId: string; path: string }) => cb(p)
      ipcRenderer.on('ra:chat:stream:file', fn)
      return () => ipcRenderer.removeListener('ra:chat:stream:file', fn)
    },
    onAiChatStreamStart: (cb: (p: { streamId: string; providerType?: string; model?: string }) => void) => {
      const fn = (_ev: IpcRendererEvent, p: unknown) => cb(p as { streamId: string; providerType?: string; model?: string })
      ipcRenderer.on('ai:chatStreamStart', fn)
      return () => ipcRenderer.removeListener('ai:chatStreamStart', fn)
    },
    onAiChatStreamChunk: (cb: (p: { streamId: string; chunk: string }) => void) => {
      const fn = (_ev: IpcRendererEvent, p: unknown) => cb(p as { streamId: string; chunk: string })
      ipcRenderer.on('ai:chatStreamChunk', fn)
      return () => ipcRenderer.removeListener('ai:chatStreamChunk', fn)
    },
    onAiChatStreamDone: (
      cb: (p: {
        streamId: string
        cancelled?: boolean
        fullTextLength?: number
        error?: boolean
        chunkCount?: number
      }) => void
    ) => {
      const fn = (_ev: IpcRendererEvent, p: unknown) =>
        cb(
          p as {
            streamId: string
            cancelled?: boolean
            fullTextLength?: number
            error?: boolean
            chunkCount?: number
          }
        )
      ipcRenderer.on('ai:chatStreamDone', fn)
      return () => ipcRenderer.removeListener('ai:chatStreamDone', fn)
    },
    onAiChatStreamError: (cb: (p: { streamId: string; error: string }) => void) => {
      const fn = (_ev: IpcRendererEvent, p: unknown) => cb(p as { streamId: string; error: string })
      ipcRenderer.on('ai:chatStreamError', fn)
      return () => ipcRenderer.removeListener('ai:chatStreamError', fn)
    },
    guideComplete: (a: {
      userContent: string
      history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
    }) => ipcRenderer.invoke('ra:guide:complete', a) as Promise<string>
  },
  orchestrateSwarmPlaceholder: (swarmId: string) =>
    ipcRenderer.invoke('ra:orchestrate:swarm:placeholder', swarmId) as Promise<unknown>,
  gguf: {
    listPaths: () => ipcRenderer.invoke('ra:gguf:paths') as Promise<string[]>,
    setPaths: (paths: string[]) => ipcRenderer.invoke('ra:gguf:paths:set', paths) as Promise<void>
  },
  secrets: {
    load: () => ipcRenderer.invoke('ra:secrets:load') as Promise<Record<string, string>>,
    get: (k: string) => ipcRenderer.invoke('ra:secrets:get', k) as Promise<string | undefined>,
    set: (k: string, v: string) => ipcRenderer.invoke('ra:secrets:set', k, v) as Promise<void>,
    clear: (k: string) => ipcRenderer.invoke('ra:secrets:clear', k) as Promise<void>
  },
  llm: {
    chat: (a: {
      url: string
      model: string
      messages: Array<{ role: string; content: string }>
      temperature?: number
      max_tokens?: number
    }) => ipcRenderer.invoke('llm:chat', a) as Promise<string>,
    test: (a: { url: string; model: string }) =>
      ipcRenderer.invoke('llm:test', a) as Promise<{ ok: boolean; error?: string; sample?: string }>
  },
  cortex: {
    configure: (a: { url?: string }) => ipcRenderer.invoke('cortex:configure', a) as Promise<{ ok: boolean; url: string }>,
    connect: () => ipcRenderer.invoke('cortex:connect') as Promise<{ ok: boolean; error?: string }>,
    test: (url?: string) => ipcRenderer.invoke('cortex:test', url) as Promise<{ ok: boolean; error?: string; connected?: boolean; hasToken?: boolean }>,
    insightTest: (a: { url?: string; clientId: string; clientSecret: string; headsetId: string; streams: string[] }) =>
      ipcRenderer.invoke('cortex:insightTest', a) as Promise<
        { ok: true; sessionId: string; headsets: unknown } | { ok: false; error: string }
      >,
    requestAccess: () => ipcRenderer.invoke('cortex:requestAccess') as Promise<unknown>,
    authorize: (clientId: string, clientSecret: string, license?: string) =>
      ipcRenderer.invoke('cortex:authorize', clientId, clientSecret, license) as Promise<unknown>,
    queryHeadsets: () => ipcRenderer.invoke('cortex:queryHeadsets') as Promise<unknown>,
    controlDevice: (a: { command: 'connect' | 'disconnect'; headset: string }) =>
      ipcRenderer.invoke('cortex:controlDevice', a) as Promise<unknown>,
    createSession: (headset: string) => ipcRenderer.invoke('cortex:createSession', headset) as Promise<string>,
    subscribe: (streams: string[], sessionId?: string) => ipcRenderer.invoke('cortex:subscribe', streams, sessionId) as Promise<unknown>,
    unsubscribe: (streams: string[], sessionId?: string) => ipcRenderer.invoke('cortex:unsubscribe', streams, sessionId) as Promise<unknown>,
    closeSession: () => ipcRenderer.invoke('cortex:closeSession') as Promise<unknown>,
    disconnect: () => ipcRenderer.invoke('cortex:disconnect') as Promise<{ ok: boolean }>,
    getState: () =>
      ipcRenderer.invoke('cortex:state') as Promise<{
        connected: boolean
        token: boolean
        session: string | null
        headset: string | null
      }>
  },
  onCortexPush: (cb: (d: unknown) => void) => {
    const h = (_e: IpcRendererEvent, d: unknown) => cb(d)
    ipcRenderer.on('cortex:push', h)
    return () => {
      ipcRenderer.removeListener('cortex:push', h)
    }
  }
}

/** Dialog invokers must be stable function references (see workspace below). */
function pickWorkspaceDirectory() {
  return ipcRenderer.invoke('cerebral:dialog:pickDirectory') as Promise<{ path: string | null }>
}
function pickDirectoryParent() {
  return ipcRenderer.invoke('cerebral:dialog:pickDirectoryParent') as Promise<{ path: string | null }>
}
function pickWorkspaceFile() {
  return ipcRenderer.invoke('cerebral:dialog:pickFile') as Promise<{ path: string | null }>
}

const cerebral = {
  /**
   * Top-level folder pickers — some Electron/contextBridge builds omit nested functions
   * under `workspace`, which made `pickDirectory` appear missing in the renderer.
   */
  pickWorkspaceDirectory,
  pickDirectoryParent,
  pickWorkspaceFile,
  workspace: {
    default: () => ipcRenderer.invoke('cerebral:workspace:default') as Promise<{ id: string; rootPath: string | null; name: string }>,
    list: () => ipcRenderer.invoke('cerebral:workspace:list') as Promise<unknown[]>,
    recent: () =>
      ipcRenderer.invoke('cerebral:workspace:recent') as Promise<
        Array<{ name: string; path: string; openedAt: string }>
      >,
    setRoot: (a: { rootPath: string; displayName?: string }) =>
      ipcRenderer.invoke('cerebral:workspace:setRoot', a) as Promise<
        { ok: true; rootPath: string; name: string } | { ok: false; error: string }
      >,
    pickDirectory: pickWorkspaceDirectory,
    pickDirectoryParent,
    gitClone: (a: { parentDir: string; url: string }) =>
      ipcRenderer.invoke('cerebral:git:clone', a) as Promise<
        { ok: true; rootPath: string; name: string } | { ok: false; error: string }
      >,
    writeFile: (a: { relativePath: string; content: string; workspaceId?: string }) =>
      ipcRenderer.invoke('cerebral:workspace:writeFile', a) as Promise<
        { ok: true; path: string } | { ok: false; error: string }
      >,
    readFile: (a: { relativePath: string; workspaceId?: string }) =>
      ipcRenderer.invoke('cerebral:workspace:readFile', a) as Promise<
        { ok: true; path: string; content: string } | { ok: false; error: string }
      >,
    editFile: (a: {
      relativePath: string
      find: string
      replace: string
      replaceAll?: boolean
      workspaceId?: string
    }) =>
      ipcRenderer.invoke('cerebral:workspace:editFile', a) as Promise<
        { ok: true; path: string } | { ok: false; error: string }
      >,
    deleteFile: (a: { relativePath: string; workspaceId?: string }) =>
      ipcRenderer.invoke('cerebral:workspace:deleteFile', a) as Promise<
        { ok: true; path: string } | { ok: false; error: string }
      >,
    createDirectory: (a: { relativePath: string; workspaceId?: string }) =>
      ipcRenderer.invoke('cerebral:workspace:createDirectory', a) as Promise<
        { ok: true; path: string } | { ok: false; error: string }
      >,
    runCommandStream: (a: { runId: string; command: string; workspaceId?: string }) =>
      ipcRenderer.invoke('cerebral:workspace:runCommandStream', a) as Promise<
        { ok: true } | { ok: false; error: string }
      >,
    onCommandChunk: (
      cb: (p: { runId: string; stream: 'stdout' | 'stderr'; data: string }) => void
    ) => {
      const h = (_e: IpcRendererEvent, p: unknown) => cb(p as { runId: string; stream: 'stdout' | 'stderr'; data: string })
      ipcRenderer.on('cerebral:workspace:commandChunk', h)
      return () => {
        ipcRenderer.removeListener('cerebral:workspace:commandChunk', h)
      }
    },
    onCommandExit: (
      cb: (p: { runId: string; code: number; signal: string | null; error?: string }) => void
    ) => {
      const h = (_e: IpcRendererEvent, p: unknown) => cb(p as { runId: string; code: number; signal: string | null; error?: string })
      ipcRenderer.on('cerebral:workspace:commandExit', h)
      return () => {
        ipcRenderer.removeListener('cerebral:workspace:commandExit', h)
      }
    }
  },
  tabs: {
    get: (workspaceId: string) => ipcRenderer.invoke('cerebral:tabs:get', workspaceId) as Promise<unknown[]>,
    replace: (a: {
      workspaceId: string
      tabs: Array<{ id: string; title: string; type: string; data_json: string | null; sort_order: number; is_dirty: number }>
    }) => ipcRenderer.invoke('cerebral:tabs:replace', a) as Promise<void>
  },
  terminal: {
    run: (a: { workspaceId: string; cwd: string; command: string; source: 'manual' | 'agent'; approvalId?: string | null }) =>
      ipcRenderer.invoke('cerebral:terminal:run', a) as Promise<{
        ok: boolean
        exitCode: number
        stdout: string
        stderr: string
        id: string
        blocked?: string
      }>,
    start: (a: { workspaceId: string; cwd: string; command: string; source: 'manual' | 'agent'; approvalId?: string | null }) =>
      ipcRenderer.invoke('cerebral:terminal:start', a) as Promise<{
        sessionId: string | null
        blocked?: string
      }>,
    cancel: (sessionId: string) =>
      ipcRenderer.invoke('cerebral:terminal:cancel', sessionId) as Promise<{ ok: boolean; error?: string }>,
    getCwd: () => ipcRenderer.invoke('cerebral:terminal:getCwd') as Promise<{ path: string }>,
    setCwd: (p: string) => ipcRenderer.invoke('cerebral:terminal:setCwd', p) as Promise<{ ok: boolean; error?: string; path?: string }>,
    history: (limit?: number) => ipcRenderer.invoke('cerebral:terminal:history', limit) as Promise<unknown[]>,
    onChunk: (
      cb: (p: { sessionId: string; stream: 'stdout' | 'stderr'; data: string; source: 'manual' | 'agent'; command: string }) => void
    ) => {
      const h = (_e: IpcRendererEvent, p: unknown) =>
        cb(
          p as { sessionId: string; stream: 'stdout' | 'stderr'; data: string; source: 'manual' | 'agent'; command: string }
        )
      ipcRenderer.on('cerebral:terminal:chunk', h)
      return () => {
        ipcRenderer.removeListener('cerebral:terminal:chunk', h)
      }
    },
    onExit: (
      cb: (p: {
        sessionId: string
        code: number
        signal: string | null
        cancelled?: boolean
        error?: string
        source: 'manual' | 'agent'
        command: string
      }) => void
    ) => {
      const h = (_e: IpcRendererEvent, p: unknown) =>
        cb(
          p as {
            sessionId: string
            code: number
            signal: string | null
            cancelled?: boolean
            error?: string
            source: 'manual' | 'agent'
            command: string
          }
        )
      ipcRenderer.on('cerebral:terminal:exit', h)
      return () => {
        ipcRenderer.removeListener('cerebral:terminal:exit', h)
      }
    }
  },
  toolRequest: {
    list: (status?: string) => ipcRenderer.invoke('cerebral:toolRequest:list', status) as Promise<unknown[]>,
    submit: (body: Record<string, unknown>) =>
      ipcRenderer.invoke('cerebral:toolRequest:submit', body) as Promise<{ id: string; ok: boolean }>,
    decide: (a: { id: string; approved: boolean }) =>
      ipcRenderer.invoke('cerebral:toolRequest:decide', a) as Promise<{
        ok: boolean
        error?: string
        ran: {
          exitCode: number
          stdout: string
          stderr: string
          blocked?: string
          streaming?: boolean
          sessionId?: string | null
        } | null
      }>
  },
  providerLog: {
    list: (limit?: number) => ipcRenderer.invoke('cerebral:providerLog:list', limit) as Promise<unknown[]>
  },
  skill: {
    list: () => ipcRenderer.invoke('cerebral:skill:list') as Promise<unknown[]>,
    upsert: (r: Record<string, unknown>) => ipcRenderer.invoke('cerebral:skill:upsert', r) as Promise<void>,
    links: (agentId: string) => ipcRenderer.invoke('cerebral:skill:links', agentId) as Promise<string[]>,
    link: (a: { agentId: string; skillId: string }) => ipcRenderer.invoke('cerebral:skill:link', a) as Promise<void>
  },
  gguf: {
    list: () => ipcRenderer.invoke('cerebral:gguf:list') as Promise<unknown[]>,
    upsert: (r: Record<string, unknown>) => ipcRenderer.invoke('cerebral:gguf:upsert', r) as Promise<void>
  },
  /**
   * Command Execution Confirmation bridge — all execution runs in the main process.
   */
  command: {
    previewMatch: (text: string) =>
      ipcRenderer.invoke('command:previewMatch', { text }) as Promise<{
        match: null | {
          id: string
          phrase: string
          aliasesMatched: string[]
          score: number
          mode: string
          category: string
          actionPreview: { type: string; [k: string]: unknown }
          riskLevel: string
          requiresConfirmation: boolean
        }
      }>,
    run: (a: CerebralCommandRunPayload) =>
      ipcRenderer.invoke('command:run', a) as Promise<{
        ok: boolean
        output?: string
        error?: string
        status?: string
      }>,
    executeHotkey: (a: CerebralCommandRunPayload) => ipcRenderer.invoke('command:executeHotkey', a) as CerebralCommandRunResult,
    executeKeypress: (a: CerebralCommandRunPayload) => ipcRenderer.invoke('command:executeKeypress', a) as CerebralCommandRunResult,
    executeShell: (a: CerebralCommandRunPayload) => ipcRenderer.invoke('command:executeShell', a) as CerebralCommandRunResult,
    executeSocket: (a: CerebralCommandRunPayload) => ipcRenderer.invoke('command:executeSocket', a) as CerebralCommandRunResult,
    executeInternal: (a: CerebralCommandRunPayload) => ipcRenderer.invoke('command:executeInternal', a) as CerebralCommandRunResult
  },
  window: {
    toggleDevtools: () => ipcRenderer.invoke('cerebral:window:toggleDevtools') as Promise<{ ok: true }>,
    getState: () => ipcRenderer.invoke('cerebral:window:getState') as Promise<{ ok: true; maximized: boolean } | { ok: false }>,
    minimize: () => ipcRenderer.invoke('cerebral:window:minimize') as Promise<{ ok: true }>,
    maximizeToggle: () =>
      ipcRenderer.invoke('cerebral:window:maximizeToggle') as Promise<{ ok: true; maximized: boolean } | { ok: false; maximized: false }>,
    close: () => ipcRenderer.invoke('cerebral:window:close') as Promise<{ ok: true }>,
    onState: (cb: (p: { maximized: boolean }) => void) => {
      const fn = (_e: IpcRendererEvent, p: { maximized: boolean }) => cb(p)
      ipcRenderer.on('cerebral:window:state', fn)
      return () => {
        ipcRenderer.removeListener('cerebral:window:state', fn)
      }
    }
  },
  app: {
    quit: () => ipcRenderer.invoke('cerebral:app:quit') as Promise<{ ok: true }>,
    about: () => ipcRenderer.invoke('cerebral:app:about') as Promise<{ name: string; version: string }>
  },
  /**
   * AI chat streaming — same as `ra.chat.completeStream` + cancel; exposed for a stable `window.cerebral` API.
   */
  ai: {
    startChatStream: (a: Parameters<typeof ra.chat.completeStream>[0]) => ra.chat.completeStream(a),
    cancelChatStream: (streamId: string) => ra.chat.cancelStream(streamId),
    onChatStreamChunk: (cb: (p: { streamId: string; chunk: string }) => void) => ra.chat.onAiChatStreamChunk(cb),
    onChatStreamDone: (
      cb: (p: { streamId: string; cancelled?: boolean; fullTextLength?: number; error?: boolean; chunkCount?: number }) => void
    ) => ra.chat.onAiChatStreamDone(cb),
    onChatStreamError: (cb: (p: { streamId: string; error: string }) => void) => ra.chat.onAiChatStreamError(cb)
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('cerebral:shell:openExternal', url) as Promise<{ ok: boolean; error?: string }>
  },
  pty: {
    spawn: (a: { cwd?: string; cols: number; rows: number }) =>
      ipcRenderer.invoke('cerebral:pty:spawn', a) as Promise<
        { ok: true; id: string; cwd: string; shell: string } | { ok: false; error: string }
      >,
    write: (a: { id: string; data: string }) => ipcRenderer.invoke('cerebral:pty:write', a) as Promise<{ ok: boolean; error?: string }>,
    resize: (a: { id: string; cols: number; rows: number }) =>
      ipcRenderer.invoke('cerebral:pty:resize', a) as Promise<{ ok: boolean; error?: string }>,
    clear: (a: { id: string }) => ipcRenderer.invoke('cerebral:pty:clear', a) as Promise<{ ok: boolean; error?: string }>,
    kill: (a: { id: string }) => ipcRenderer.invoke('cerebral:pty:kill', a) as Promise<{ ok: boolean; error?: string }>,
    onData: (cb: (p: { id: string; data: string }) => void) => {
      const h = (_e: IpcRendererEvent, p: { id: string; data: string }) => cb(p)
      ipcRenderer.on('cerebral:pty:data', h)
      return () => {
        ipcRenderer.removeListener('cerebral:pty:data', h)
      }
    },
    onExit: (cb: (p: { id: string; code: number; signal: number | null }) => void) => {
      const h = (_e: IpcRendererEvent, p: { id: string; code: number; signal: number | null }) => cb(p)
      ipcRenderer.on('cerebral:pty:exit', h)
      return () => {
        ipcRenderer.removeListener('cerebral:pty:exit', h)
      }
    }
  }
}

contextBridge.exposeInMainWorld('ra', ra)
contextBridge.exposeInMainWorld('cerebral', cerebral)
/** Legacy name (older builds) — same API object. */
contextBridge.exposeInMainWorld('cerbral', cerebral)

export type RaApi = typeof ra
export type CerebralApi = typeof cerebral
