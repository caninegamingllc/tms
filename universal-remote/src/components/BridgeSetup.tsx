import type { BridgeState } from '../hooks/useBridge'
import { RemoteKey } from './RemoteKey'

type Props = {
  bridge: BridgeState
}

export function BridgeSetup({ bridge }: Props) {
  return (
    <section className="animate-slide-up mx-auto w-full max-w-[420px] space-y-4">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Bridge</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          The phone UI talks to a small bridge on your PC (same Wi‑Fi as the
          TVs). Start it with <code className="text-[var(--accent)]">npm run bridge</code>.
        </p>
      </header>

      <div className="rounded-2xl border border-[var(--chassis-edge)] bg-[var(--chassis)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-[var(--muted)]">Status</span>
          <span
            className="inline-flex items-center gap-2 text-sm font-medium"
            style={{
              color: bridge.connected ? 'var(--accent)' : 'var(--danger)',
            }}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{
                background: bridge.connected
                  ? 'var(--accent)'
                  : 'var(--danger)',
                animation: bridge.connected
                  ? 'pulse-dot 1.6s ease-in-out infinite'
                  : undefined,
              }}
            />
            {bridge.connected ? 'Connected' : 'Offline'}
          </span>
        </div>

        <label className="block text-sm text-[var(--muted)]">Bridge URL</label>
        <input
          value={bridge.settings.bridgeUrl}
          onChange={(e) =>
            bridge.updateSettings({ bridgeUrl: e.target.value.trim() })
          }
          placeholder="http://192.168.1.20:8787"
          className="mt-1 w-full rounded-xl border border-[var(--chassis-edge)] bg-[var(--bg-deep)] px-3 py-2 font-[var(--font-mono)] text-sm outline-none focus:border-[var(--accent)]"
        />

        <RemoteKey
          className="mt-3 w-full"
          variant="accent"
          onClick={() => void bridge.refresh()}
        >
          Test connection
        </RemoteKey>
      </div>

      {bridge.lanAddresses.length > 0 ? (
        <div className="rounded-2xl border border-[var(--chassis-edge)] bg-[var(--chassis)] p-4">
          <p className="text-sm font-medium">LAN addresses from bridge</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            On your phone, use one of these instead of localhost:
          </p>
          <ul className="mt-3 space-y-2">
            {bridge.lanAddresses.map((addr) => (
              <li key={addr}>
                <button
                  type="button"
                  className="w-full rounded-xl bg-[var(--key)] px-3 py-2 text-left font-[var(--font-mono)] text-sm hover:bg-[var(--key-press)]"
                  onClick={() =>
                    bridge.updateSettings({
                      bridgeUrl: `http://${addr}:8787`,
                    })
                  }
                >
                  http://{addr}:8787
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--muted)]">
        <li>Clone this repo onto the PC on your home Wi‑Fi.</li>
        <li>
          Run <code className="text-[var(--key-label)]">npm install</code> then{' '}
          <code className="text-[var(--key-label)]">npm run bridge</code>.
        </li>
        <li>Allow Node through Windows Firewall if prompted.</li>
        <li>Paste the LAN URL above into Bridge URL on your phone.</li>
        <li>Scan for TVs and pair when asked.</li>
      </ol>
    </section>
  )
}
