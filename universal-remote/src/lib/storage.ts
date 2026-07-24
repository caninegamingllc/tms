const STORAGE_KEY = 'universal-remote.settings.v1'

export interface Settings {
  bridgeUrl: string
  activeDeviceId: string | null
}

const defaults: Settings = {
  bridgeUrl: 'http://127.0.0.1:8787',
  activeDeviceId: null,
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...defaults }
    return { ...defaults, ...JSON.parse(raw) }
  } catch {
    return { ...defaults }
  }
}

export function saveSettings(partial: Partial<Settings>): Settings {
  const next = { ...loadSettings(), ...partial }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}
