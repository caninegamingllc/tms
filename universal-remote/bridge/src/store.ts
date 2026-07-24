import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DeviceRecord } from './types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data')
const STORE_PATH = join(DATA_DIR, 'devices.json')

function ensure() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  if (!existsSync(STORE_PATH)) writeFileSync(STORE_PATH, '[]', 'utf8')
}

export function loadDevices(): DeviceRecord[] {
  ensure()
  try {
    return JSON.parse(readFileSync(STORE_PATH, 'utf8')) as DeviceRecord[]
  } catch {
    return []
  }
}

export function saveDevices(devices: DeviceRecord[]) {
  ensure()
  writeFileSync(STORE_PATH, JSON.stringify(devices, null, 2), 'utf8')
}

export function upsertDevice(
  partial: Omit<DeviceRecord, 'id'> & { id?: string },
): DeviceRecord {
  const devices = loadDevices()
  const existing = devices.find(
    (d) =>
      (partial.id && d.id === partial.id) ||
      (d.host === partial.host && d.platform === partial.platform),
  )
  if (existing) {
    Object.assign(existing, partial, {
      id: existing.id,
      meta: { ...existing.meta, ...partial.meta },
    })
    saveDevices(devices)
    return existing
  }
  const device: DeviceRecord = {
    id: partial.id ?? randomUUID(),
    name: partial.name,
    platform: partial.platform,
    host: partial.host,
    port: partial.port,
    online: partial.online,
    paired: partial.paired ?? false,
    meta: partial.meta ?? {},
  }
  devices.push(device)
  saveDevices(devices)
  return device
}

export function removeDevice(id: string) {
  const next = loadDevices().filter((d) => d.id !== id)
  saveDevices(next)
}

export function getDevice(id: string) {
  return loadDevices().find((d) => d.id === id)
}

export function updateDevice(id: string, patch: Partial<DeviceRecord>) {
  const devices = loadDevices()
  const idx = devices.findIndex((d) => d.id === id)
  if (idx < 0) return null
  devices[idx] = {
    ...devices[idx],
    ...patch,
    meta: { ...devices[idx].meta, ...patch.meta },
  }
  saveDevices(devices)
  return devices[idx]
}
