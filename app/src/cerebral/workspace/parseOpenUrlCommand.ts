/**
 * If a shell command is only “open this http(s) URL in the default browser”,
 * return the URL and let the app open it in the built-in webview instead.
 * Conservative: `start npm` / `start notepad` are not treated as URLs.
 */
export function tryGetUrlFromShellOpenCommand(command: string): string | null {
  const t = command.trim()
  if (!t) {
    return null
  }

  // Windows: start …
  const win = /^start\s+(.+)$/is.exec(t)
  if (win) {
    return normalizeUrlArg(win[1].trim())
  }

  // macOS / Git Bash
  const mac = /^open\s+(.+)$/is.exec(t)
  if (mac) {
    return normalizeUrlArg(mac[1].trim())
  }

  const xdg = /^xdg-open\s+(.+)$/is.exec(t)
  if (xdg) {
    return normalizeUrlArg(xdg[1].trim())
  }

  return null
}

function normalizeUrlArg(rest: string): string | null {
  // start "" "https://..." (Windows)
  const emptyQuote = /^(?:""|'')\s+"(.+)"\s*$/s.exec(rest) ?? /^(?:""|'')\s+'(.+)'\s*$/s.exec(rest)
  if (emptyQuote) {
    return tryToHttpUrl(emptyQuote[1].trim())
  }
  if ((rest.startsWith('"') && rest.endsWith('"')) || (rest.startsWith("'") && rest.endsWith("'"))) {
    return tryToHttpUrl(rest.slice(1, -1).trim())
  }
  return tryToHttpUrl(rest)
}

function tryToHttpUrl(s: string): string | null {
  if (!/^https?:\/\//i.test(s) && !/^file:/i.test(s)) {
    return null
  }
  try {
    return new URL(s).toString()
  } catch {
    return null
  }
}
