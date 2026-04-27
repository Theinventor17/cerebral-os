import type { WorkspaceAction } from './WorkspaceTypes'
import { runStreamedWorkspaceCommand } from './WorkspaceRunner'
import { tryGetUrlFromShellOpenCommand } from './parseOpenUrlCommand'

const WID = 'default'

function ws() {
  return window.cerebral?.workspace
}

export async function executeWriteFile(path: string, content: string): Promise<{ ok: true; abs: string } | { ok: false; error: string }> {
  const w = ws()
  if (!w?.writeFile) {
    return { ok: false, error: 'Workspace API unavailable' }
  }
  const r = await w.writeFile({ relativePath: path, content, workspaceId: WID })
  return r.ok ? { ok: true, abs: r.path } : r
}

export async function executeEditFile(
  path: string,
  find: string,
  replace: string,
  replaceAll?: boolean
): Promise<{ ok: true; abs: string } | { ok: false; error: string }> {
  const w = ws()
  if (!w?.editFile) {
    return { ok: false, error: 'Workspace API unavailable' }
  }
  const r = await w.editFile({ relativePath: path, find, replace, replaceAll, workspaceId: WID })
  return r.ok ? { ok: true, abs: r.path } : r
}

export async function executeDeleteFile(path: string): Promise<{ ok: true; abs: string } | { ok: false; error: string }> {
  const w = ws()
  if (!w?.deleteFile) {
    return { ok: false, error: 'Workspace API unavailable' }
  }
  const r = await w.deleteFile({ relativePath: path, workspaceId: WID })
  return r.ok ? { ok: true, abs: r.path } : r
}

export async function executeCreateDirectory(path: string): Promise<{ ok: true; abs: string } | { ok: false; error: string }> {
  const w = ws()
  if (!w?.createDirectory) {
    return { ok: false, error: 'Workspace API unavailable' }
  }
  const r = await w.createDirectory({ relativePath: path, workspaceId: WID })
  return r.ok ? { ok: true, abs: r.path } : r
}

export async function executeReadFile(path: string): Promise<{ ok: true; content: string; abs: string } | { ok: false; error: string }> {
  const w = ws()
  if (!w?.readFile) {
    return { ok: false, error: 'Workspace API unavailable' }
  }
  const r = await w.readFile({ relativePath: path, workspaceId: WID })
  return r.ok ? { ok: true, content: r.content, abs: r.path } : r
}

/** @returns lines for summary */
export async function executeWorkspaceAction(
  action: WorkspaceAction,
  opts: {
    onCommandChunk?: (stream: 'stdout' | 'stderr', data: string) => void
    /** When a command is e.g. `start https://…`, open here instead of the system browser. */
    onOpenUrlInBrowser?: (url: string) => void
  }
): Promise<{ lines: string[] }> {
  const lines: string[] = []
  switch (action.type) {
    case 'write_file': {
      const r = await executeWriteFile(action.path, action.content)
      if (r.ok) {
        lines.push(`- **Wrote** \`${action.path}\``)
      } else {
        lines.push(`- **write_file** \`${action.path}\`: ${r.error}`)
      }
      break
    }
    case 'edit_file': {
      const r = await executeEditFile(action.path, action.find, action.replace, action.replaceAll)
      if (r.ok) {
        lines.push(`- **Edited** \`${action.path}\``)
      } else {
        lines.push(`- **edit_file** \`${action.path}\`: ${r.error}`)
      }
      break
    }
    case 'delete_file': {
      const r = await executeDeleteFile(action.path)
      if (r.ok) {
        lines.push(`- **Deleted** \`${action.path}\``)
      } else {
        lines.push(`- **delete_file** \`${action.path}\`: ${r.error}`)
      }
      break
    }
    case 'create_directory': {
      const r = await executeCreateDirectory(action.path)
      if (r.ok) {
        lines.push(`- **Created directory** \`${action.path}\``)
      } else {
        lines.push(`- **create_directory** \`${action.path}\`: ${r.error}`)
      }
      break
    }
    case 'read_file': {
      const r = await executeReadFile(action.path)
      if (r.ok) {
        const clip = r.content.length > 8000 ? r.content.slice(0, 8000) + '\n…' : r.content
        lines.push(`- **read_file** \`${action.path}\`\n\`\`\`\n${clip}\n\`\`\``)
      } else {
        lines.push(`- **read_file** \`${action.path}\`: ${r.error}`)
      }
      break
    }
    case 'open_file': {
      lines.push(`- **Opened** \`${action.path}\` in the editor.`)
      break
    }
    case 'run_command': {
      const fromShell = tryGetUrlFromShellOpenCommand(action.command)
      if (fromShell && opts.onOpenUrlInBrowser) {
        opts.onOpenUrlInBrowser(fromShell)
        lines.push(
          `- **Opened in built-in browser** \`${fromShell}\` (skipped OS \`start\` / \`open\` so the app webview is used)\n`
        )
        break
      }
      const runId = crypto.randomUUID()
      try {
        const result = await runStreamedWorkspaceCommand(runId, action.command, WID, {
          onChunk: opts.onCommandChunk
        })
        const preview = result.out.length > 4000 ? result.out.slice(0, 4000) + '\n…' : result.out
        lines.push(
          `- **Ran** \`${action.command}\` (exit **${result.code}**)\n\`\`\`text\n${preview || '(no output)'}\n\`\`\``
        )
      } catch (e) {
        lines.push(`- **run_command** \`${action.command}\`: ${(e as Error).message}`)
      }
      break
    }
  }
  return { lines }
}
