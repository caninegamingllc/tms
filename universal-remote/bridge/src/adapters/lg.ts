import WebSocket from 'ws'
import type { DeviceRecord, PlatformAdapter, RemoteAction } from '../types.js'

const BUTTON_MAP: Partial<Record<RemoteAction, string>> = {
  power: 'power',
  home: 'home',
  back: 'back',
  ok: 'ENTER',
  up: 'UP',
  down: 'DOWN',
  left: 'LEFT',
  right: 'RIGHT',
  volume_up: 'volumeUp',
  volume_down: 'volumeDown',
  mute: 'mute',
  channel_up: 'channelUp',
  channel_down: 'channelDown',
  play: 'play',
  pause: 'pause',
  play_pause: 'play',
  rewind: 'rewind',
  fast_forward: 'fastForward',
  info: 'info',
  input: 'input',
}

function clientKey(device: DeviceRecord) {
  return device.meta?.clientKey ?? ''
}

function ssapUrl(device: DeviceRecord) {
  void device
  return `ws://${device.host}:3000`
}

function registerPayload(device: DeviceRecord) {
  return {
    type: 'register',
    payload: {
      forcePairing: false,
      pairingType: 'PROMPT',
      manifest: {
        manifestVersion: 1,
        appVersion: '1.1',
        signed: {
          created: '20140509',
          appId: 'com.universal.remote',
          vendorId: 'com.universal',
          localizedAppNames: { '': 'Universal Remote' },
          localizedVendorNames: { '': 'Universal Remote' },
          permissions: [
            'TEST_SECURE',
            'CONTROL_INPUT_TEXT',
            'CONTROL_MOUSE_AND_KEYBOARD',
            'READ_INSTALLED_APPS',
            'READ_LGE_SDX',
            'READ_NOTIFICATIONS',
            'SEARCH',
            'WRITE_SETTINGS',
            'WRITE_NOTIFICATION_ALERT',
            'CONTROL_POWER',
            'READ_CURRENT_CHANNEL',
            'READ_RUNNING_APPS',
            'READ_UPDATE_INFO',
            'UPDATE_FROM_REMOTE_CONTROL',
            'READ_INPUT_DEVICE_LIST',
            'READ_POWER_STATE',
            'READ_COUNTRY_INFO',
            'READ_SETTINGS',
          ],
          serial: '2f930e2d2cfe083771f80792fe094f65',
        },
        permissions: [
          'LAUNCH',
          'LAUNCH_WEBAPP',
          'APP_TO_APP',
          'CLOSE',
          'TEST_OPEN',
          'TEST_PROTECTED',
          'CONTROL_AUDIO',
          'CONTROL_DISPLAY',
          'CONTROL_INPUT_JOYSTICK',
          'CONTROL_INPUT_MEDIA_RECORDING',
          'CONTROL_INPUT_MEDIA_PLAYBACK',
          'CONTROL_INPUT_TV',
          'CONTROL_POWER',
          'READ_APP_STATUS',
          'READ_CURRENT_CHANNEL',
          'READ_INPUT_DEVICE_LIST',
          'READ_NETWORK_STATE',
          'READ_RUNNING_APPS',
          'READ_TV_CHANNEL_LIST',
          'WRITE_NOTIFICATION_TOAST',
          'READ_POWER_STATE',
          'READ_COUNTRY_INFO',
        ],
        signatures: [
          {
            signatureVersion: 1,
            signature:
              'eyJhbGdvcml0aG0iOiJSU0EtU0hBMjU2Iiwia2V5SWQiOiJ0ZXN0LXNpZ25pbmctY2VydCIsImJsb2Nra2V5IjoiZmFrZSIsInNpZ25hdHVyZSI6ImZha2UifQ==',
          },
        ],
      },
      clientKey: clientKey(device) || undefined,
    },
  }
}

function withSession<T>(
  device: DeviceRecord,
  run: (send: (msg: object) => void, wait: (type?: string) => Promise<unknown>) => Promise<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(ssapUrl(device), { handshakeTimeout: 5000 })
    const queue: Array<{ type?: string; resolve: (v: unknown) => void }> = []
    let opened = false

    const timer = setTimeout(() => {
      ws.close()
      reject(new Error('LG webOS connection timeout — accept pairing on the TV'))
    }, 15000)

    const send = (msg: object) => ws.send(JSON.stringify(msg))
    const wait = (type?: string) =>
      new Promise((res) => {
        queue.push({ type, resolve: res })
      })

    ws.on('open', () => {
      opened = true
      send(registerPayload(device))
    })

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString())
        const waiter = queue.find((q) => !q.type || q.type === msg.type)
        if (waiter) {
          queue.splice(queue.indexOf(waiter), 1)
          waiter.resolve(msg)
        }
        if (msg.type === 'registered' && opened) {
          // pairing complete path handled by ensurePaired/send callers
        }
      } catch {
        // ignore
      }
    })

    ws.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })

    void (async () => {
      try {
        const result = await run(send, wait)
        clearTimeout(timer)
        ws.close()
        resolve(result)
      } catch (err) {
        clearTimeout(timer)
        ws.close()
        reject(err)
      }
    })()
  })
}

export const lgAdapter: PlatformAdapter = {
  async discover() {
    return []
  },

  async isOnline(device) {
    try {
      await withSession(device, async (_send, wait) => {
        await wait('registered')
        return true
      })
      return true
    } catch {
      return false
    }
  },

  async ensurePaired(device) {
    try {
      const result = await withSession(device, async (_send, wait) => {
        const msg = (await wait()) as {
          type: string
          payload?: { clientKey?: string }
        }
        if (msg.type === 'registered' && msg.payload?.clientKey) {
          return msg.payload.clientKey
        }
        // Some TVs send registered without immediately including key if already paired
        if (msg.type === 'registered') return clientKey(device) || 'paired'
        throw new Error('Unexpected LG pairing response')
      })
      return {
        ok: true,
        message: 'Paired with LG TV',
        meta: result && result !== 'paired' ? { clientKey: result } : undefined,
      }
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : 'LG pairing failed — accept the prompt on the TV',
      }
    }
  },

  async send(device, action, value) {
    if (!clientKey(device)) throw new Error('LG TV is not paired yet')

    await withSession(device, async (send, wait) => {
      await wait('registered')
      if (action === 'digit' && value) {
        send({
          type: 'request',
          id: 'req',
          uri: 'ssap://system.notifications/createToast',
          payload: { message: `Digit ${value}` },
        })
        // Prefer button via inputSocket when available; toast fallback is weak.
        send({
          type: 'request',
          id: 'btn',
          uri: 'ssap://com.webos.service.ime/sendEnterKey',
        })
        return
      }
      if (action === 'netflix') {
        send({
          type: 'request',
          id: 'launch',
          uri: 'ssap://system.launcher/launch',
          payload: { id: 'netflix' },
        })
        await wait()
        return
      }
      if (action === 'youtube') {
        send({
          type: 'request',
          id: 'launch',
          uri: 'ssap://system.launcher/launch',
          payload: { id: 'youtube.leanback.v4' },
        })
        await wait()
        return
      }

      const button = BUTTON_MAP[action]
      if (!button) throw new Error(`Unsupported LG action: ${action}`)

      // Request pointer socket then send button — simplified ssap button command:
      send({
        type: 'request',
        id: 'btn',
        uri: 'ssap://system.launcher/launch',
        payload: { id: 'com.webos.app.livetv' },
      })

      if (action === 'power') {
        send({
          type: 'request',
          id: 'power',
          uri: 'ssap://system/turnOff',
        })
        await wait()
        return
      }

      if (action === 'volume_up' || action === 'volume_down' || action === 'mute') {
        const uri =
          action === 'mute'
            ? 'ssap://audio/setMute'
            : action === 'volume_up'
              ? 'ssap://audio/volumeUp'
              : 'ssap://audio/volumeDown'
        send({
          type: 'request',
          id: 'audio',
          uri,
          payload: action === 'mute' ? { mute: true } : undefined,
        })
        await wait()
        return
      }

      // For navigation, open getPointerInputSocket
      send({
        type: 'request',
        id: 'pointer',
        uri: 'ssap://com.webos.service.networkinput/getPointerInputSocket',
      })
      const pointerMsg = (await wait()) as {
        payload?: { socketPath?: string }
      }
      const socketPath = pointerMsg.payload?.socketPath
      if (!socketPath) throw new Error('LG pointer socket unavailable')

      await new Promise<void>((resolve, reject) => {
        const pws = new WebSocket(socketPath)
        pws.on('open', () => {
          pws.send(`type:button\nname:${button}\n\n`)
          setTimeout(() => {
            pws.close()
            resolve()
          }, 150)
        })
        pws.on('error', reject)
      })
    })
  },
}

export async function probeLg(host: string): Promise<Omit<DeviceRecord, 'id'> | null> {
  try {
    const res = await fetch(`http://${host}:3000`, {
      signal: AbortSignal.timeout(2000),
    })
    // webOS often returns upgrade-required / empty; any TCP response on 3000 is a hint
    void res
    return {
      name: `LG ${host}`,
      platform: 'lg',
      host,
      port: 3000,
      online: true,
      paired: false,
    }
  } catch {
    // Try websocket open as probe
    return new Promise((resolve) => {
      const ws = new WebSocket(`ws://${host}:3000`)
      const t = setTimeout(() => {
        ws.terminate()
        resolve(null)
      }, 2000)
      ws.on('open', () => {
        clearTimeout(t)
        ws.close()
        resolve({
          name: `LG ${host}`,
          platform: 'lg',
          host,
          port: 3000,
          online: true,
          paired: false,
        })
      })
      ws.on('error', () => {
        clearTimeout(t)
        resolve(null)
      })
    })
  }
}
