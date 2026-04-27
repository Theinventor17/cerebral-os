import type { ReactNode } from 'react'

type Props = {
  /** `side` = left panel; `screen` = full Model providers settings */
  variant: 'side' | 'screen'
}

/**
 * Single map: there is no separate “API keys” vault—keys are per provider in ◫ Providers.
 */
export function ProviderSetupMap({ variant }: Props): ReactNode {
  return (
    <div
      className={`cos-pmap${variant === 'side' ? ' cos-pmap--side' : ' cos-pmap--screen'}`}
      role="note"
      aria-label="Where to put API keys"
    >
      <div className="cos-pmap-title">Where do I put API keys?</div>
      <ol className="cos-pmap-list">
        <li>
          Open <span className="cos-pmap-kb">◫ Providers</span> in the left bar (models and keys live here).
        </li>
        <li>
          Pick a provider or add one, then paste the key in the <strong>API key</strong> field and save.
        </li>
        <li>Choose that provider in the composer’s provider menu and pick a model.</li>
      </ol>
    </div>
  )
}
