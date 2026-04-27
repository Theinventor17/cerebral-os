/**
 * Local GGUF path registry (paths only). Serving is assumed through llama.cpp or similar local server.
 */
export const LocalGGUFRegistry = {
  async listPaths(): Promise<string[]> {
    return window.ra.gguf.listPaths()
  },

  async setPaths(paths: string[]): Promise<void> {
    return window.ra.gguf.setPaths(paths)
  }
}
