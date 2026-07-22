import WebSocket from 'ws'
import type { DeviceRecord, PlatformAdapter, RemoteAction } from '../types.js'

const KEY_MAP: Partial<Record<RemoteAction, string>> = {
  power: 'KEY_POWER',
  home: 'KEY_HOME',
  back: 'KEY_RETURN',
  ok: 'KEY_ENTER',
  up: 'KEY_UP',
  down: 'KEY_DOWN',
  left: 'KEY_LEFT',
  right: 'KEY_RIGHT',
  volume_up: 'KEY_VOLUP',
  volume_down: 'KEY_VOLDOWN',
  mute: 'KEY_MUTE',
  channel_up: 'KEY_CHUP',
  channel_down: 'KEY_CHDOWN',
  play: 'KEY_PLAY',
  pause: 'KEY_PAUSE',
  play_pause: 'KEY_PLAY',
  rewind: 'KEY_REWIND',
  fast_forward: 'KEY_FF',
  info: 'KEY_INFO',
  input: 'KEY_SOURCE',
  netflix: 'KEY_HOME',
  youtube: 'KEY_HOME',
}

function appName() {
  return Buffer.from('UniversalRemote').toString('base64')
}

function buildUrl(device: DeviceRecord, token?: string) {
  const port = device.port ?? 8002
  const tokenPart = token ? `&token=${token}` : ''
  return `wss://${device.host}:${port}/api/v2/channels/samsung.remote.control?name=${appName()}${tokenPart}`
}

function sendWs(url: string, payload: object, expectToken = false): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, {
      rejectUnauthorized: false,
      handshakeTimeout: 5000,
    })
    const timer = setTimeout(() => {
      ws.close()
      reject(new Error('Samsung WebSocket timeout'))
    }, 8000)

    ws.on('open', () => {
      ws.send(JSON.stringify(payload))
      if (!expectToken) {
        setTimeout(() => {
          clearTimeout(timer)
          ws.close()
          resolve(undefined)
        }, 300)
      }
    })

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString())
        const token = msg?.data?.token as string | undefined
        if (token) {
          clearTimeout(timer)
          ws.close()
          resolve(token)
        }
      } catch {
        // ignore
      }
    })

    ws.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

export const samsungAdapter: PlatformAdapter = {
  async discover() {
    return []
  },

  async isOnline(device) {
    try {
      const res = await fetch(`http://${device.host}:8001/api/v2/`, {
        signal: AbortSignal.timeout(2500),
      })
      return res.ok
    } catch {
      return false
    }
  },

  async ensurePaired(device, code) {
    // First connection prompts Allow on the TV; token returned and stored.
    void code
    const token = device.meta?.token
    const url = buildUrl(device, token)
    try {
      const newToken = await sendWs(
        url,
        {
          method: 'ms.channel.connect',
          params: { channels: ['samsung.remote.control'] },
        },
        !token,
      )
      return {
        ok: true,
        message: newToken
          ? 'Paired — token saved. Accept the prompt on the TV if shown.'
          : 'Already paired',
        meta: newToken ? { token: newToken } : undefined,
      }
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : 'Samsung pairing failed — accept the prompt on the TV',
      }
    }
  },

  async send(device, action, value) {
    const token = device.meta?.token
    if (!token) throw new Error('Samsung TV is not paired yet')

    if (action === 'digit' && value) {
      await sendWs(buildUrl(device, token), {
        method: 'ms.remote.control',
        params: {
          Cmd: 'Click',
          DataOfCmd: `KEY_${value}`,
          Option: 'false',
          TypeOfRemote: 'SendRemoteKey',
        },
      })
      return
    }

    const key = KEY_MAP[action]
    if (!key) throw new Error(`Unsupported Samsung action: ${action}`)
    await sendWs(buildUrl(device, token), {
      method: 'ms.remote.control',
      params: {
        Cmd: 'Click',
        DataOfCmd: key,
        Option: 'false',
        TypeOfRemote: 'SendRemoteKey',
      },
    })
  },
}

export async function probeSamsung(
  host: string,
): Promise<Omit<DeviceRecord, 'id'> | null> {
  try {
    const res = await fetch(`http://${host}:8001/api/v2/`, {
      signal: AbortSignal.timeout(2500),
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      device?: { name?: string; FrameTVSupport?: string }
    }
    return {
      name: data.device?.name ?? `Samsung ${host}`,
      platform: 'samsung',
      host,
      port: 8002,
      online: true,
      paired: false,
    }
  } catch {
    return null
  }
}
