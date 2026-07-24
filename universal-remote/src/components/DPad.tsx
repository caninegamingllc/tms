import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'
import { RemoteKey } from './RemoteKey'
import type { RemoteAction } from '../lib/types'

type Props = {
  onAction: (action: RemoteAction) => void
  disabled?: boolean
}

export function DPad({ onAction, disabled }: Props) {
  return (
    <div className="mx-auto grid w-[220px] grid-cols-3 grid-rows-3 gap-2">
      <div />
      <RemoteKey
        size="lg"
        disabled={disabled}
        aria-label="Up"
        onClick={() => onAction('up')}
      >
        <ChevronUp size={22} />
      </RemoteKey>
      <div />
      <RemoteKey
        size="lg"
        disabled={disabled}
        aria-label="Left"
        onClick={() => onAction('left')}
      >
        <ChevronLeft size={22} />
      </RemoteKey>
      <RemoteKey
        size="lg"
        variant="accent"
        disabled={disabled}
        aria-label="OK"
        onClick={() => onAction('ok')}
      >
        OK
      </RemoteKey>
      <RemoteKey
        size="lg"
        disabled={disabled}
        aria-label="Right"
        onClick={() => onAction('right')}
      >
        <ChevronRight size={22} />
      </RemoteKey>
      <div />
      <RemoteKey
        size="lg"
        disabled={disabled}
        aria-label="Down"
        onClick={() => onAction('down')}
      >
        <ChevronDown size={22} />
      </RemoteKey>
      <div />
    </div>
  )
}
