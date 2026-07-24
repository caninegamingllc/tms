import type {
  AppInfo,
  BridgeHealth,
  CommandRequest,
  Device,
  PairRequest,
} from './types'

export class BridgeError extends Error {
  status: number
  constructor(message: string, status = 500) {
    super(message)
    this.status = status
  }
}

async function request<T>(
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${baseUrl.replace(/\/$/, '')}${path}`
  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })
  } catch {
    throw new BridgeError(
      'Cannot reach bridge. Is it running on your Wi‑Fi PC?',
      0,
    )
  }

  const text = await res.text()
  const data = text ? JSON.parse(text) : {}
  if (!res.ok) {
    throw new BridgeError(data.error ?? res.statusText, res.status)
  }
  return data as T
}

export const bridgeApi = {
  health(baseUrl: string) {
    return request<BridgeHealth>(baseUrl, '/health')
  },
  listDevices(baseUrl: string) {
    return request<{ devices: Device[] }>(baseUrl, '/devices')
  },
  scan(baseUrl: string) {
    return request<{ devices: Device[] }>(baseUrl, '/devices/scan', {
      method: 'POST',
    })
  },
  addDevice(baseUrl: string, device: Omit<Device, 'id'> & { id?: string }) {
    return request<{ device: Device }>(baseUrl, '/devices', {
      method: 'POST',
      body: JSON.stringify(device),
    })
  },
  removeDevice(baseUrl: string, deviceId: string) {
    return request<{ ok: boolean }>(baseUrl, `/devices/${deviceId}`, {
      method: 'DELETE',
    })
  },
  command(baseUrl: string, body: CommandRequest) {
    return request<{ ok: boolean }>(baseUrl, '/command', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },
  pair(baseUrl: string, body: PairRequest) {
    return request<{ ok: boolean; message?: string }>(baseUrl, '/pair', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },
  apps(baseUrl: string, deviceId: string) {
    return request<{ apps: AppInfo[] }>(baseUrl, `/devices/${deviceId}/apps`)
  },
}
