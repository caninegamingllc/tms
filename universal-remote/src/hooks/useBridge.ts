import { useCallback, useEffect, useState } from 'react'
import { bridgeApi, BridgeError } from '../lib/bridge-client'
import { loadSettings, saveSettings, type Settings } from '../lib/storage'
import type { Device, RemoteAction } from '../lib/types'

export function useBridge() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [devices, setDevices] = useState<Device[]>([])
  const [connected, setConnected] = useState(false)
  const [lanAddresses, setLanAddresses] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastAction, setLastAction] = useState<string | null>(null)

  const updateSettings = useCallback((partial: Partial<Settings>) => {
    setSettings(saveSettings(partial))
  }, [])

  const refresh = useCallback(async () => {
    try {
      const health = await bridgeApi.health(settings.bridgeUrl)
      setConnected(health.ok)
      setLanAddresses(health.lanAddresses ?? [])
      const list = await bridgeApi.listDevices(settings.bridgeUrl)
      setDevices(list.devices)
      setError(null)
      if (
        settings.activeDeviceId &&
        !list.devices.some((d) => d.id === settings.activeDeviceId)
      ) {
        updateSettings({ activeDeviceId: list.devices[0]?.id ?? null })
      } else if (!settings.activeDeviceId && list.devices[0]) {
        updateSettings({ activeDeviceId: list.devices[0].id })
      }
    } catch (err) {
      setConnected(false)
      setDevices([])
      setError(err instanceof BridgeError ? err.message : 'Bridge offline')
    }
  }, [settings.bridgeUrl, settings.activeDeviceId, updateSettings])

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => void refresh(), 8000)
    return () => window.clearInterval(id)
  }, [refresh])

  const scan = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await bridgeApi.scan(settings.bridgeUrl)
      setDevices(result.devices)
      if (!settings.activeDeviceId && result.devices[0]) {
        updateSettings({ activeDeviceId: result.devices[0].id })
      }
    } catch (err) {
      setError(err instanceof BridgeError ? err.message : 'Scan failed')
    } finally {
      setBusy(false)
    }
  }, [settings.bridgeUrl, settings.activeDeviceId, updateSettings])

  const send = useCallback(
    async (action: RemoteAction, value?: string) => {
      if (!settings.activeDeviceId) {
        setError('Select a device first')
        return
      }
      setLastAction(value ? `${action}:${value}` : action)
      try {
        await bridgeApi.command(settings.bridgeUrl, {
          deviceId: settings.activeDeviceId,
          action,
          value,
        })
        setError(null)
      } catch (err) {
        setError(err instanceof BridgeError ? err.message : 'Command failed')
      }
    },
    [settings.activeDeviceId, settings.bridgeUrl],
  )

  const pair = useCallback(
    async (deviceId: string, code?: string) => {
      setBusy(true)
      try {
        const result = await bridgeApi.pair(settings.bridgeUrl, {
          deviceId,
          code,
        })
        await refresh()
        return result
      } catch (err) {
        const message =
          err instanceof BridgeError ? err.message : 'Pairing failed'
        setError(message)
        throw err
      } finally {
        setBusy(false)
      }
    },
    [settings.bridgeUrl, refresh],
  )

  const activeDevice =
    devices.find((d) => d.id === settings.activeDeviceId) ?? null

  return {
    settings,
    updateSettings,
    devices,
    activeDevice,
    connected,
    lanAddresses,
    busy,
    error,
    setError,
    lastAction,
    refresh,
    scan,
    send,
    pair,
  }
}

export type BridgeState = ReturnType<typeof useBridge>
