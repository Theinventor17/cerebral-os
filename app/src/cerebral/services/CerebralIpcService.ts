export function getCerebral() {
  return window.cerebral
}

export async function loadWorkspaceDefault(): Promise<{ id: string; rootPath: string | null; name: string }> {
  return window.cerebral.workspace.default()
}
