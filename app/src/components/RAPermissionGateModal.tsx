import { useResonantAgents } from '../providers/ResonantAgentsProvider'

export function RAPermissionGateModal() {
  const { permissionModal, closeShellGate, resolveShellGate } = useResonantAgents()
  if (!permissionModal.open) {
    return null
  }
  return (
    <div
      className="ra-perm-back"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,3,10,0.75)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24
      }}
      role="dialog"
      aria-modal
    >
      <div
        className="ra-perm-box"
        style={{
          maxWidth: 420,
          width: '100%',
          background: '#0e1828',
          border: '1px solid #9b5cff',
          borderRadius: 10,
          padding: 20
        }}
      >
        <h2 style={{ margin: '0 0 8px 0', fontSize: 14, textTransform: 'uppercase' }}>Permission gate</h2>
        <p className="ra-mute" style={{ margin: '0 0 6px' }}>
          {permissionModal.message}
        </p>
        <p className="ra-mute" style={{ margin: '0 0 16px' }}>
          Approval required. Autonomous tool execution is a placeholder. Shell tool is not enabled in this build.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="ra-btn ra-btn-ghost" onClick={() => resolveShellGate(false)}>
            Deny
          </button>
          <button
            type="button"
            className="ra-btn"
            onClick={() => {
              resolveShellGate(true)
            }}
          >
            Approve (no-op)
          </button>
        </div>
        <button type="button" className="ra-dashed-link" style={{ marginTop: 10, border: 0, background: 'none', cursor: 'pointer' }} onClick={closeShellGate}>
          Close
        </button>
      </div>
    </div>
  )
}
