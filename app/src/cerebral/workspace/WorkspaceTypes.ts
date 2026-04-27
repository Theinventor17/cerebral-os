/** Parsed + validated tool actions (main process enforces paths / execution). */

export type WorkspaceAction =
  | {
      type: 'write_file'
      path: string
      content: string
    }
  | {
      type: 'edit_file'
      path: string
      find: string
      replace: string
      /** If true, replace all non-overlapping matches; otherwise first match only. */
      replaceAll?: boolean
    }
  | {
      type: 'delete_file'
      path: string
    }
  | {
      type: 'create_directory'
      path: string
    }
  | {
      type: 'run_command'
      command: string
    }
  | {
      type: 'open_file'
      path: string
    }
  | {
      type: 'read_file'
      path: string
    }

export type WorkspaceProposal = {
  sessionId: string
  assistantMessageId: string
  sourceFullText: string
  actions: WorkspaceAction[]
}
