import { Radio, Settings2, Tv } from 'lucide-react'
import { useState } from 'react'
import { AppsStrip } from './components/AppsStrip'
import { BridgeSetup } from './components/BridgeSetup'
import { DeviceList } from './components/DeviceList'
import { RemotePanel } from './components/RemotePanel'
import { useBridge } from './hooks/useBridge'
import type { Screen } from './lib/types'

const NAV: { id: Screen; label: string; icon: typeof Tv }[] = [
  { id: 'remote', label: 'Remote', icon: Radio },
  { id: 'devices', label: 'Devices', icon: Tv },
  { id: 'setup', label: 'Bridge', icon: Settings2 },
]

export default function App() {
  const bridge = useBridge()
  const [screen, setScreen] = useState<Screen>('remote')

  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-col px-4 pb-28 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">
            Living room control
          </p>
          <p className="text-sm text-[var(--muted)]">
            {bridge.connected ? 'Bridge online' : 'Bridge offline'}
            {bridge.activeDevice ? ` · ${bridge.activeDevice.name}` : ''}
          </p>
        </div>
      </div>

      {bridge.error ? (
        <div className="mb-4 rounded-2xl border border-[#5a2a2a] bg-[#2a1616] px-4 py-3 text-sm text-[#ffd0d0]">
          {bridge.error}
        </div>
      ) : null}

      {screen === 'remote' ? (
        <>
          <RemotePanel
            device={bridge.activeDevice}
            disabled={!bridge.connected}
            onAction={(action, value) => void bridge.send(action, value)}
          />
          <AppsStrip
            disabled={!bridge.connected || !bridge.activeDevice}
            onAction={(action, value) => void bridge.send(action, value)}
          />
        </>
      ) : null}

      {screen === 'devices' ? <DeviceList bridge={bridge} /> : null}
      {screen === 'setup' ? <BridgeSetup bridge={bridge} /> : null}

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--chassis-edge)] bg-[color-mix(in_srgb,var(--bg-deep)_92%,transparent)] px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg justify-around">
          {NAV.map((item) => {
            const Icon = item.icon
            const active = screen === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setScreen(item.id)}
                className="flex flex-col items-center gap-1 px-4 py-1 text-xs transition"
                style={{
                  color: active ? 'var(--accent)' : 'var(--muted)',
                }}
              >
                <Icon size={20} />
                {item.label}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
