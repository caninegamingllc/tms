import { LoaderCircle, Radar, Trash2, Unplug } from 'lucide-react'
import { useState } from 'react'
import type { BridgeState } from '../hooks/useBridge'
import type { Platform } from '../lib/types'
import { bridgeApi } from '../lib/bridge-client'
import { RemoteKey } from './RemoteKey'

const PLATFORMS: Platform[] = ['roku', 'samsung', 'lg', 'android', 'fire']

type Props = {
  bridge: BridgeState
}

export function DeviceList({ bridge }: Props) {
  const [manualHost, setManualHost] = useState('')
  const [manualName, setManualName] = useState('')
  const [manualPlatform, setManualPlatform] = useState<Platform>('roku')
  const [pairCode, setPairCode] = useState('')
  const [pairingId, setPairingId] = useState<string | null>(null)

  return (
    <section className="animate-slide-up mx-auto w-full max-w-[420px] space-y-4">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Devices</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Scan your LAN or add a TV by IP. Pairing may show a code on screen.
        </p>
      </header>

      <div className="flex gap-2">
        <RemoteKey
          className="flex-1"
          variant="accent"
          disabled={!bridge.connected || bridge.busy}
          onClick={() => void bridge.scan()}
        >
          {bridge.busy ? (
            <LoaderCircle className="animate-spin" size={18} />
          ) : (
            <Radar size={18} />
          )}
          <span className="ml-2">Scan network</span>
        </RemoteKey>
        <RemoteKey onClick={() => void bridge.refresh()} aria-label="Refresh">
          Refresh
        </RemoteKey>
      </div>

      <ul className="space-y-2">
        {bridge.devices.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-[var(--chassis-edge)] px-4 py-8 text-center text-sm text-[var(--muted)]">
            No devices yet. Run a scan or add one manually.
          </li>
        ) : (
          bridge.devices.map((device) => {
            const active = bridge.settings.activeDeviceId === device.id
            return (
              <li
                key={device.id}
                className="rounded-2xl border border-[var(--chassis-edge)] bg-[var(--chassis)] p-4"
              >
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() =>
                    bridge.updateSettings({ activeDeviceId: device.id })
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{device.name}</p>
                      <p className="mt-0.5 font-[var(--font-mono)] text-xs text-[var(--muted)]">
                        {device.platform} · {device.host}
                        {device.port ? `:${device.port}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{
                          background: device.online
                            ? 'var(--accent)'
                            : 'var(--danger)',
                          animation: device.online
                            ? 'pulse-dot 1.6s ease-in-out infinite'
                            : undefined,
                        }}
                      />
                      {active ? (
                        <span className="text-[var(--accent)]">Active</span>
                      ) : null}
                    </div>
                  </div>
                </button>

                <div className="mt-3 flex flex-wrap gap-2">
                  {!device.paired ? (
                    <RemoteKey
                      size="sm"
                      onClick={() => {
                        setPairingId(device.id)
                        void bridge.pair(device.id).catch(() => undefined)
                      }}
                    >
                      <Unplug size={14} />
                      <span className="ml-1">Pair</span>
                    </RemoteKey>
                  ) : (
                    <span className="self-center text-xs text-[var(--accent)]">
                      Paired
                    </span>
                  )}
                  <RemoteKey
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void bridgeApi
                        .removeDevice(bridge.settings.bridgeUrl, device.id)
                        .then(() => bridge.refresh())
                    }
                  >
                    <Trash2 size={14} />
                  </RemoteKey>
                </div>

                {pairingId === device.id ? (
                  <div className="mt-3 flex gap-2">
                    <input
                      value={pairCode}
                      onChange={(e) => setPairCode(e.target.value)}
                      placeholder="TV pairing code"
                      className="min-w-0 flex-1 rounded-xl border border-[var(--chassis-edge)] bg-[var(--bg-deep)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                    />
                    <RemoteKey
                      size="sm"
                      variant="accent"
                      onClick={() =>
                        void bridge
                          .pair(device.id, pairCode)
                          .then(() => {
                            setPairingId(null)
                            setPairCode('')
                          })
                          .catch(() => undefined)
                      }
                    >
                      Confirm
                    </RemoteKey>
                  </div>
                ) : null}
              </li>
            )
          })
        )}
      </ul>

      <form
        className="space-y-3 rounded-2xl border border-[var(--chassis-edge)] bg-[var(--chassis)] p-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!manualHost.trim()) return
          void bridgeApi
            .addDevice(bridge.settings.bridgeUrl, {
              name: manualName.trim() || `${manualPlatform} TV`,
              platform: manualPlatform,
              host: manualHost.trim(),
            })
            .then((res) => {
              bridge.updateSettings({ activeDeviceId: res.device.id })
              setManualHost('')
              setManualName('')
              return bridge.refresh()
            })
            .catch((err: Error) => bridge.setError(err.message))
        }}
      >
        <p className="text-sm font-medium">Add by IP</p>
        <input
          value={manualName}
          onChange={(e) => setManualName(e.target.value)}
          placeholder="Living Room"
          className="w-full rounded-xl border border-[var(--chassis-edge)] bg-[var(--bg-deep)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
        <input
          value={manualHost}
          onChange={(e) => setManualHost(e.target.value)}
          placeholder="192.168.1.50"
          required
          className="w-full rounded-xl border border-[var(--chassis-edge)] bg-[var(--bg-deep)] px-3 py-2 font-[var(--font-mono)] text-sm outline-none focus:border-[var(--accent)]"
        />
        <select
          value={manualPlatform}
          onChange={(e) => setManualPlatform(e.target.value as Platform)}
          className="w-full rounded-xl border border-[var(--chassis-edge)] bg-[var(--bg-deep)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        >
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <RemoteKey type="submit" className="w-full" variant="accent">
          Add device
        </RemoteKey>
      </form>
    </section>
  )
}
