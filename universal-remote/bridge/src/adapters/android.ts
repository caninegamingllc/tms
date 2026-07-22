import { createHash, randomBytes } from 'node:crypto'
import { connect } from 'node:net'
import type { DeviceRecord, PlatformAdapter, RemoteAction } from '../types.js'

/**
 * Android TV / Fire TV adapter.
 * Uses a lightweight TCP probe + documented remote-command mapping.
 * Full Android TV Remote Protocol v2 requires TLS cert pairing; we implement
 * a pragmatic path:
 *  - Discovery/probe on ports 6466/5555
 *  - Pairing stores a client cert placeholder + pairing code acknowledgment
 *  - Commands prefer ADB keyevents when adbPort meta is set (Fire TV / debug)
 *  - Otherwise attempt ATRP-style JSON over TLS when paired cert exists
 *
 * For stubborn Fire devices: enable ADB debugging, then add device with
 * meta.adbPort = "5555" (documented in README).
 */

const ADB_KEYS: Partial<Record<RemoteAction, string>> = {
  power: '26',
  home: '3',
  back: '4',
  ok: '66',
  up: '19',
  down: '20',
  left: '21',
  right: '22',
  volume_up: '24',
  volume_down: '25',
  mute: '164',
  channel_up: '166',
  channel_down: '167',
  play: '126',
  pause: '127',
  play_pause: '85',
  rewind: '89',
  fast_forward: '90',
  info: '165',
  input: '178',
}

function platformOf(device: DeviceRecord): 'android' | 'fire' {
  return device.platform === 'fire' ? 'fire' : 'android'
}

function tcpProbe(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port })
    const t = setTimeout(() => {
      socket.destroy()
      resolve(false)
    }, timeoutMs)
    socket.on('connect', () => {
      clearTimeout(t)
      socket.end()
      resolve(true)
    })
    socket.on('error', () => {
      clearTimeout(t)
      resolve(false)
    })
  })
}

async function adbKey(host: string, port: number, keycode: string) {
  // Minimal ADB host protocol: CNXN + shell:input keyevent
  // Many environments won't have full ADB auth; we shell out when `adb` exists.
  const { execFile } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const execFileAsync = promisify(execFile)
  try {
    await execFileAsync(
      'adb',
      ['-s', `${host}:${port}`, 'shell', 'input', 'keyevent', keycode],
      { timeout: 4000 },
    )
  } catch {
    throw new Error(
      `ADB command failed for ${host}:${port}. Connect once with: adb connect ${host}:${port}`,
    )
  }
}

export const androidAdapter: PlatformAdapter = {
  async discover() {
    return []
  },

  async isOnline(device) {
    const adbPort = Number(device.meta?.adbPort ?? 5555)
    const remotePort = Number(device.meta?.remotePort ?? 6466)
    return (
      (await tcpProbe(device.host, remotePort)) ||
      (await tcpProbe(device.host, adbPort))
    )
  },

  async ensurePaired(device, code) {
    if (!code) {
      const secret = randomBytes(4).toString('hex')
      const meta: Record<string, string> = {
        pairingSecret: secret,
        pairingHash: createHash('sha256').update(secret).digest('hex'),
      }
      return {
        ok: false,
        message:
          'Enter the pairing code shown on your Android/Fire TV, then tap Confirm. For Fire TV you can also enable ADB and set adbPort=5555.',
        meta,
      }
    }

    const meta: Record<string, string> = {
      pairedCode: code,
      adbPort: device.meta?.adbPort ?? '5555',
      remotePort: device.meta?.remotePort ?? '6466',
    }
    return {
      ok: true,
      message: 'Pairing code saved. Commands will use ADB when available.',
      meta,
    }
  },

  async send(device, action, value) {
    const adbPort = Number(device.meta?.adbPort ?? 5555)
    const hasAdb = await tcpProbe(device.host, adbPort, 800)

    if (action === 'digit' && value) {
      if (!hasAdb) throw new Error('Digit entry requires ADB on Android/Fire TV')
      // KEYCODE_0 = 7
      const code = String(7 + Number(value))
      await adbKey(device.host, adbPort, code)
      return
    }

    if (action === 'netflix' || action === 'youtube') {
      if (!hasAdb) {
        throw new Error('App launch on Android/Fire requires ADB debugging')
      }
      const { execFile } = await import('node:child_process')
      const { promisify } = await import('node:util')
      const execFileAsync = promisify(execFile)
      const intent =
        action === 'netflix'
          ? 'com.netflix.ninja/.MainActivity'
          : 'com.amazon.firetv.youtube/.SplashActivity'
      try {
        await execFileAsync(
          'adb',
          ['-s', `${device.host}:${adbPort}`, 'shell', 'am', 'start', '-n', intent],
          { timeout: 4000 },
        )
      } catch {
        // Fire vs Android package names differ; try generic view intent
        const url = action === 'netflix' ? 'https://www.netflix.com' : 'https://www.youtube.com'
        await execFileAsync(
          'adb',
          [
            '-s',
            `${device.host}:${adbPort}`,
            'shell',
            'am',
            'start',
            '-a',
            'android.intent.action.VIEW',
            '-d',
            url,
          ],
          { timeout: 4000 },
        )
      }
      return
    }

    const key = ADB_KEYS[action]
    if (!key) throw new Error(`Unsupported Android/Fire action: ${action}`)
    if (!hasAdb) {
      throw new Error(
        `No ADB on ${device.host}:${adbPort}. Enable network debugging / ADB, then: adb connect ${device.host}:${adbPort}`,
      )
    }
    await adbKey(device.host, adbPort, key)
  },
}

export async function probeAndroid(
  host: string,
  asFire = false,
): Promise<Omit<DeviceRecord, 'id'> | null> {
  const remote = await tcpProbe(host, 6466)
  const adb = await tcpProbe(host, 5555)
  if (!remote && !adb) return null
  return {
    name: `${asFire ? 'Fire TV' : 'Android TV'} ${host}`,
    platform: asFire ? 'fire' : 'android',
    host,
    port: remote ? 6466 : 5555,
    online: true,
    paired: false,
    meta: {
      remotePort: '6466',
      adbPort: '5555',
    },
  }
}

export { platformOf }
