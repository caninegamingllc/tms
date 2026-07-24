import cors from 'cors'
import express from 'express'
import { androidAdapter } from './adapters/android.js'
import { lgAdapter } from './adapters/lg.js'
import { rokuAdapter } from './adapters/roku.js'
import { samsungAdapter } from './adapters/samsung.js'
import { listLanAddresses, scanNetwork } from './discovery.js'
import {
  getDevice,
  loadDevices,
  removeDevice,
  updateDevice,
  upsertDevice,
} from './store.js'
import type { Platform, PlatformAdapter, RemoteAction } from './types.js'

const PORT = Number(process.env.PORT ?? 8787)
const VERSION = '1.0.0'

const adapters: Record<Platform, PlatformAdapter> = {
  roku: rokuAdapter,
  samsung: samsungAdapter,
  lg: lgAdapter,
  android: androidAdapter,
  fire: androidAdapter,
}

const app = express()
app.use(cors({ origin: true }))
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    version: VERSION,
    lanAddresses: listLanAddresses(),
  })
})

app.get('/devices', async (_req, res) => {
  const devices = loadDevices()
  const withStatus = await Promise.all(
    devices.map(async (device) => {
      const adapter = adapters[device.platform]
      const online = adapter ? await adapter.isOnline(device).catch(() => false) : false
      return updateDevice(device.id, { online }) ?? { ...device, online }
    }),
  )
  res.json({ devices: withStatus })
})

app.post('/devices/scan', async (_req, res) => {
  try {
    const devices = await scanNetwork()
    res.json({ devices })
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Scan failed',
    })
  }
})

app.post('/devices', (req, res) => {
  const { name, platform, host, port, meta } = req.body ?? {}
  if (!name || !platform || !host) {
    res.status(400).json({ error: 'name, platform, and host are required' })
    return
  }
  if (!adapters[platform as Platform]) {
    res.status(400).json({ error: `Unsupported platform: ${platform}` })
    return
  }
  const device = upsertDevice({
    name,
    platform,
    host,
    port,
    meta,
    paired: platform === 'roku',
    online: true,
  })
  res.status(201).json({ device })
})

app.delete('/devices/:id', (req, res) => {
  removeDevice(req.params.id)
  res.json({ ok: true })
})

app.post('/pair', async (req, res) => {
  const { deviceId, code } = req.body ?? {}
  const device = getDevice(deviceId)
  if (!device) {
    res.status(404).json({ error: 'Device not found' })
    return
  }
  const adapter = adapters[device.platform]
  try {
    const result = await adapter.ensurePaired(device, code)
    if (result.meta) {
      updateDevice(device.id, {
        paired: result.ok,
        meta: result.meta,
      })
    } else if (result.ok) {
      updateDevice(device.id, { paired: true })
    }
    res.json(result)
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Pairing failed',
    })
  }
})

app.post('/command', async (req, res) => {
  const { deviceId, action, value } = req.body ?? {}
  const device = getDevice(deviceId)
  if (!device) {
    res.status(404).json({ error: 'Device not found' })
    return
  }
  if (!action) {
    res.status(400).json({ error: 'action is required' })
    return
  }
  const adapter = adapters[device.platform]
  try {
    await adapter.send(device, action as RemoteAction, value)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Command failed',
    })
  }
})

app.get('/devices/:id/apps', async (req, res) => {
  const device = getDevice(req.params.id)
  if (!device) {
    res.status(404).json({ error: 'Device not found' })
    return
  }
  const adapter = adapters[device.platform]
  if (!adapter.listApps) {
    res.json({ apps: [] })
    return
  }
  try {
    const apps = await adapter.listApps(device)
    res.json({ apps })
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to list apps',
    })
  }
})

app.listen(PORT, '0.0.0.0', () => {
  const lans = listLanAddresses()
  console.log(`Universal Remote bridge v${VERSION}`)
  console.log(`Listening on http://0.0.0.0:${PORT}`)
  for (const ip of lans) {
    console.log(`  Phone URL: http://${ip}:${PORT}`)
  }
})
