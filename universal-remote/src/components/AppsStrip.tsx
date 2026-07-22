import { RemoteKey } from './RemoteKey'
import type { RemoteAction } from '../lib/types'

type Props = {
  disabled?: boolean
  onAction: (action: RemoteAction, value?: string) => void
}

const APPS: { label: string; action: RemoteAction; value?: string }[] = [
  { label: 'Netflix', action: 'netflix' },
  { label: 'YouTube', action: 'youtube' },
  { label: 'Home', action: 'home' },
]

export function AppsStrip({ disabled, onAction }: Props) {
  return (
    <div className="mx-auto mt-4 flex w-full max-w-[380px] gap-2 overflow-x-auto pb-1">
      {APPS.map((app) => (
        <RemoteKey
          key={app.label}
          className="flex-1"
          disabled={disabled}
          onClick={() => onAction(app.action, app.value)}
        >
          {app.label}
        </RemoteKey>
      ))}
    </div>
  )
}
