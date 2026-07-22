import { createSocket } from 'node:dgram'
import { networkInterfaces } from 'node:os'
import { probeAndroid } from './adapters/android.js'
import { probeLg } from './adapters/lg.js'
import { probeRoku } from './adapters/roku.js'
import { probeSamsung } from './adapters/samsung.js'
import { upsertDevice } from './store.js'
import type { DeviceRecord } from './types.js'

function lanCidrs(): string[] {
  const nets = networkInterfaces()
  const bases: string[] = []
  for (const entries of Object.values(nets)) {
    for (const e of entries ?? []) {
      if (e.family !== 'IPv4' || e.internal) continue
      const parts = e.address.split('.').map(Number)
      bases.push(`${parts[0]}.${parts[1]}.${parts[2]}`)
    }
  }
  return [...new Set(bases)]
}

export function listLanAddresses(): string[] {
  const nets = networkInterfaces()
  const out: string[] = []
  for (const entries of Object.values(nets)) {
    for (const e of entries ?? []) {
      if (e.family === 'IPv4' && !e.internal) out.push(e.address)
    }
  }
  return out
}

async function ssdpSearch(timeoutMs = 2500): Promise<string[]> {
  const hosts = new Set<string>()
  const socket = createSocket('udp4')
  const message = Buffer.from(
    'M-SEARCH * HTTP/1.1\r\n' +
      'HOST: 239.255.255.250:1900\r\n' +
      'MAN: "ssdp:discover"\r\n' +
      'MX: 2\r\n' +
      'ST: roku:ecp\r\n' +
      '\r\n',
  )

  return new Promise((resolve) => {
    socket.on('message', (msg, rinfo) => {
      hosts.add(rinfo.address)
      const text = msg.toString()
      const loc = text.match(/LOCATION:\s*(https?:\/\/[^\r\n]+)/i)?.[1]
      if (loc) {
        try {
          hosts.add(new URL(loc).hostname)
        } catch {
          // ignore
        }
      }
    })
    socket.bind(() => {
      try {
        socket.setBroadcast(true)
        socket.send(message, 1900, '239.255.255.250')
        // Also ask for general root devices
        const general = Buffer.from(
          'M-SEARCH * HTTP/1.1\r\n' +
            'HOST: 239.255.255.250:1900\r\n' +
            'MAN: "ssdp:discover"\r\n' +
            'MX: 2\r\n' +
            'ST: ssdp:all\r\n' +
            '\r\n',
        )
        socket.send(general, 1900, '239.255.255.250')
      } catch {
        // ignore
      }
    })
    setTimeout(() => {
      socket.close()
      resolve([...hosts])
    }, timeoutMs)
  })
}

async function probeHost(host: string): Promise<Omit<DeviceRecord, 'id'>[]> {
  const found: Omit<DeviceRecord, 'id'>[] = []
  const probes = await Promise.all([
    probeRoku(host),
    probeSamsung(host),
    probeLg(host),
    probeAndroid(host, false),
    probeAndroid(host, true),
  ])
  for (const p of probes) {
    if (!p) continue
    // Avoid duplicate fire+android for same host
    if (
      p.platform === 'fire' &&
      found.some((f) => f.host === host && f.platform === 'android')
    ) {
      continue
    }
    if (
      p.platform === 'android' &&
      found.some((f) => f.host === host && f.platform === 'fire')
    ) {
      continue
    }
    found.push(p)
  }
  return found
}

export async function scanNetwork(): Promise<DeviceRecord[]> {
  const ssdpHosts = await ssdpSearch()
  const candidates = new Set<string>(ssdpHosts)

  // Light /24 sweep of last octets commonly used by DHCP (bounded for speed)
  for (const base of lanCidrs()) {
    for (const last of [1, 2, 50, 100, 101, 150, 200, 201, 250]) {
      candidates.add(`${base}.${last}`)
    }
    // Also sample a denser range asynchronously limited
    for (let i = 2; i <= 254; i += 8) {
      candidates.add(`${base}.${i}`)
    }
  }

  const hosts = [...candidates]
  const chunkSize = 40
  for (let i = 0; i < hosts.length; i += chunkSize) {
    const chunk = hosts.slice(i, i + chunkSize)
    const results = await Promise.all(chunk.map((h) => probeHost(h)))
    for (const list of results) {
      for (const device of list) upsertDevice(device)
    }
  }

  return (await import('./store.js')).loadDevices()
}
