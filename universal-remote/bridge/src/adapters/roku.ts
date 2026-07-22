import type { DeviceRecord, PlatformAdapter, RemoteAction } from '../types.js'

const KEY_MAP: Record<Exclude<RemoteAction, 'digit' | 'launch_app' | 'netflix' | 'youtube'>, string> = {
  power: 'Power',
  home: 'Home',
  back: 'Back',
  ok: 'Select',
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
  volume_up: 'VolumeUp',
  volume_down: 'VolumeDown',
  mute: 'VolumeMute',
  channel_up: 'ChannelUp',
  channel_down: 'ChannelDown',
  play: 'Play',
  pause: 'Play',
  play_pause: 'Play',
  rewind: 'Rev',
  fast_forward: 'Fwd',
  info: 'Info',
  input: 'InputTuner',
}

async function ecp(host: string, path: string, method: 'GET' | 'POST' = 'POST') {
  const url = `http://${host}:8060${path}`
  const res = await fetch(url, { method, signal: AbortSignal.timeout(4000) })
  if (!res.ok) throw new Error(`Roku ECP ${res.status} for ${path}`)
  return res
}

export const rokuAdapter: PlatformAdapter = {
  async discover() {
    // SSDP discovery is handled centrally; probe common path as fallback no-op here
    return []
  },

  async isOnline(device) {
    try {
      await ecp(device.host, '/', 'GET')
      return true
    } catch {
      return false
    }
  },

  async ensurePaired() {
    return { ok: true, message: 'Roku ECP does not require pairing' }
  },

  async send(device, action, value) {
    if (action === 'digit' && value) {
      await ecp(device.host, `/keypress/Lit_${encodeURIComponent(value)}`)
      return
    }
    if (action === 'netflix') {
      await ecp(device.host, '/launch/12')
      return
    }
    if (action === 'youtube') {
      await ecp(device.host, '/launch/837')
      return
    }
    if (action === 'launch_app' && value) {
      await ecp(device.host, `/launch/${encodeURIComponent(value)}`)
      return
    }
    const key = KEY_MAP[action as keyof typeof KEY_MAP]
    if (!key) throw new Error(`Unsupported Roku action: ${action}`)
    await ecp(device.host, `/keypress/${key}`)
  },

  async listApps(device) {
    const res = await ecp(device.host, '/query/apps', 'GET')
    const xml = await res.text()
    const apps: { id: string; name: string }[] = []
    const re = /<app[^>]*id="([^"]+)"[^>]*>([^<]+)<\/app>/g
    let match: RegExpExecArray | null
    while ((match = re.exec(xml))) {
      apps.push({ id: match[1], name: match[2] })
    }
    return apps
  },
}

export async function probeRoku(host: string): Promise<Omit<DeviceRecord, 'id'> | null> {
  try {
    const res = await fetch(`http://${host}:8060/query/device-info`, {
      signal: AbortSignal.timeout(2500),
    })
    if (!res.ok) return null
    const xml = await res.text()
    const name =
      xml.match(/<user-device-name>([^<]+)<\/user-device-name>/)?.[1] ??
      xml.match(/<friendly-device-name>([^<]+)<\/friendly-device-name>/)?.[1] ??
      `Roku ${host}`
    return {
      name,
      platform: 'roku',
      host,
      port: 8060,
      online: true,
      paired: true,
    }
  } catch {
    return null
  }
}
