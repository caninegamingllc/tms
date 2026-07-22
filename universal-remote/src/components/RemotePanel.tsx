import {
  FastForward,
  Home,
  Info,
  Pause,
  Play,
  Power,
  Rewind,
  TvMinimal,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { DPad } from './DPad'
import { RemoteKey } from './RemoteKey'
import type { Device, RemoteAction } from '../lib/types'

type Props = {
  device: Device | null
  disabled?: boolean
  onAction: (action: RemoteAction, value?: string) => void
}

export function RemotePanel({ device, disabled, onAction }: Props) {
  const off = disabled || !device

  return (
    <section className="animate-slide-up mx-auto w-full max-w-[380px] rounded-[2rem] border border-[var(--chassis-edge)] bg-[var(--chassis)] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
      <header className="mb-5 text-center">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">
          Universal Remote
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">
          {device?.name ?? 'No device selected'}
        </h1>
        {device ? (
          <p className="mt-1 font-[var(--font-mono)] text-xs text-[var(--muted)]">
            {device.platform.toUpperCase()} · {device.host}
          </p>
        ) : null}
      </header>

      <div className="mb-4 flex items-center justify-between gap-3">
        <RemoteKey
          size="lg"
          variant="danger"
          disabled={off}
          aria-label="Power"
          onClick={() => onAction('power')}
        >
          <Power size={20} />
        </RemoteKey>
        <RemoteKey
          size="md"
          disabled={off}
          onClick={() => onAction('input')}
          aria-label="Input"
        >
          <TvMinimal size={18} />
          <span className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
            Input
          </span>
        </RemoteKey>
        <RemoteKey
          size="md"
          disabled={off}
          onClick={() => onAction('info')}
          aria-label="Info"
        >
          <Info size={18} />
        </RemoteKey>
      </div>

      <DPad disabled={off} onAction={onAction} />

      <div className="mt-4 grid grid-cols-3 gap-2">
        <RemoteKey disabled={off} onClick={() => onAction('back')}>
          Back
        </RemoteKey>
        <RemoteKey disabled={off} onClick={() => onAction('home')}>
          <Home size={18} />
        </RemoteKey>
        <RemoteKey disabled={off} onClick={() => onAction('play_pause')}>
          <Play size={14} className="mr-0.5" />
          <Pause size={14} />
        </RemoteKey>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        <RemoteKey disabled={off} onClick={() => onAction('rewind')}>
          <Rewind size={16} />
        </RemoteKey>
        <RemoteKey disabled={off} onClick={() => onAction('play')}>
          <Play size={16} />
        </RemoteKey>
        <RemoteKey disabled={off} onClick={() => onAction('pause')}>
          <Pause size={16} />
        </RemoteKey>
        <RemoteKey disabled={off} onClick={() => onAction('fast_forward')}>
          <FastForward size={16} />
        </RemoteKey>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-2">
          <RemoteKey disabled={off} onClick={() => onAction('volume_up')}>
            <Volume2 size={16} />
            <span className="text-[10px] text-[var(--muted)]">Vol+</span>
          </RemoteKey>
          <RemoteKey disabled={off} onClick={() => onAction('volume_down')}>
            <Volume2 size={16} />
            <span className="text-[10px] text-[var(--muted)]">Vol−</span>
          </RemoteKey>
        </div>
        <div className="flex items-center justify-center">
          <RemoteKey
            size="lg"
            disabled={off}
            onClick={() => onAction('mute')}
            aria-label="Mute"
          >
            <VolumeX size={18} />
          </RemoteKey>
        </div>
        <div className="flex flex-col gap-2">
          <RemoteKey disabled={off} onClick={() => onAction('channel_up')}>
            Ch+
          </RemoteKey>
          <RemoteKey disabled={off} onClick={() => onAction('channel_down')}>
            Ch−
          </RemoteKey>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', ''].map(
          (digit, i) =>
            digit ? (
              <RemoteKey
                key={digit}
                disabled={off}
                onClick={() => onAction('digit', digit)}
              >
                {digit}
              </RemoteKey>
            ) : (
              <div key={`spacer-${i}`} />
            ),
        )}
      </div>
    </section>
  )
}
