import type { ReactNode } from 'react'

function Kbd({ children }: { children: string }): ReactNode {
  return (
    <kbd
      style={{
        fontSize: 11,
        fontFamily: 'var(--font-mono, ui-monospace, monospace)',
        padding: '1px 5px',
        borderRadius: 3,
        border: '1px solid #1b2b42',
        background: '#0b1422',
        color: '#c4d0e0'
      }}
    >
      {children}
    </kbd>
  )
}

function Row({ action, combo }: { action: string; combo: ReactNode }): ReactNode {
  return (
    <tr>
      <td style={{ padding: '6px 10px 6px 0', verticalAlign: 'top', color: '#9fadc2' }}>{action}</td>
      <td style={{ padding: '6px 0' }}>{combo}</td>
    </tr>
  )
}

/**
 * In-app reference; README duplicates the main entries for support/docs.
 */
export function KeyboardShortcutsScreen(): ReactNode {
  return (
    <div className="ra-screen" style={{ padding: 16, maxWidth: 720 }}>
      <h1 className="ra-h1">Keyboard shortcuts</h1>
      <p className="ra-mute" style={{ fontSize: 12, lineHeight: 1.45, marginTop: 0, marginBottom: 16 }}>
        Menus in the top bar list many <strong>Ctrl+</strong> shortcuts (e.g. File, Edit, View). On <strong>macOS</strong>, the same
        menu items often use <strong>⌘</strong> where the app shows <strong>Ctrl+</strong>. Not every menu item is fully wired
        — prefer actions that are labeled as available.
      </p>

      <h2 className="ra-h1" style={{ fontSize: 14, margin: '0 0 8px' }}>
        Command palette
      </h2>
      <table
        className="ra-mute"
        style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 20 }}
      >
        <tbody>
          <Row
            action="Open or close"
            combo={
              <>
                <Kbd>Ctrl</Kbd> + <Kbd>Shift</Kbd> + <Kbd>P</Kbd> (use <Kbd>⌘</Kbd> on macOS)
              </>
            }
          />
          <Row
            action="Or click"
            combo={<>The center &quot;Ask, route, run, or configure…&quot; strip in the top bar</>}
          />
        </tbody>
      </table>
      <p className="ra-mute" style={{ fontSize: 12, lineHeight: 1.45, margin: '-8px 0 20px' }}>
        From the palette: jump to an activity, set <strong>Manual / Hybrid / Thought</strong>, open General settings, keyboard help, a browser tab, the Welcome (project) flow, or an agent chat. Type to filter; ↑ ↓ and Enter to run.
      </p>

      <h2 className="ra-h1" style={{ fontSize: 14, margin: '0 0 8px' }}>
        Composer (agent chat)
      </h2>
      <table
        className="ra-mute"
        style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 20 }}
      >
        <tbody>
          <Row action="Send message" combo={<Kbd>Enter</Kbd>} />
          <Row
            action="New line in message"
            combo={
              <>
                <Kbd>Shift</Kbd> + <Kbd>Enter</Kbd>
              </>
            }
          />
          <Row
            action="Confirm neural candidate (when Insight is live, Thought / Hybrid)"
            combo={
              <>
                <Kbd>1</Kbd> – <Kbd>5</Kbd>
              </>
            }
          />
        </tbody>
      </table>

      <h2 className="ra-h1" style={{ fontSize: 14, margin: '0 0 8px' }}>
        Session mode (title bar)
      </h2>
      <p className="ra-mute" style={{ fontSize: 12, lineHeight: 1.45, marginBottom: 8 }}>
        Click the <strong>Mode</strong> chip, or the <strong>?</strong> next to it, for a description of Manual / Hybrid /
        Thought. Use the <strong>?</strong> popover in the top bar for the same text.
      </p>

      <h2 className="ra-h1" style={{ fontSize: 14, margin: '0 0 8px' }}>
        Integrated terminal
      </h2>
      <table
        className="ra-mute"
        style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 20 }}
      >
        <tbody>
          <Row action="Run current line" combo={<Kbd>Enter</Kbd>} />
          <Row
            action="Cancel running process"
            combo={
              <>
                <Kbd>Ctrl</Kbd> + <Kbd>C</Kbd>
              </>
            }
          />
          <Row
            action="Clear terminal buffer"
            combo={
              <>
                <Kbd>Ctrl</Kbd> + <Kbd>L</Kbd>
              </>
            }
          />
          <Row
            action="History previous / next"
            combo={
              <>
                <Kbd>↑</Kbd> / <Kbd>↓</Kbd>
              </>
            }
          />
        </tbody>
      </table>
      <p className="ra-mute" style={{ fontSize: 12, lineHeight: 1.45 }}>
        The terminal footer also mentions <strong>Ctrl+K</strong> to generate a command (when that flow is available).
      </p>
    </div>
  )
}
