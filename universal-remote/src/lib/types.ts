export type Platform = 'roku' | 'samsung' | 'lg' | 'android' | 'fire'

export type RemoteAction =
  | 'power'
  | 'home'
  | 'back'
  | 'ok'
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'volume_up'
  | 'volume_down'
  | 'mute'
  | 'channel_up'
  | 'channel_down'
  | 'play'
  | 'pause'
  | 'play_pause'
  | 'rewind'
  | 'fast_forward'
  | 'info'
  | 'input'
  | 'netflix'
  | 'youtube'
  | 'digit'
  | 'launch_app'

export interface Device {
  id: string
  name: string
  platform: Platform
  host: string
  port?: number
  online?: boolean
  paired?: boolean
  meta?: Record<string, string>
}

export interface BridgeHealth {
  ok: boolean
  version: string
  lanAddresses: string[]
}

export interface CommandRequest {
  deviceId: string
  action: RemoteAction
  value?: string
}

export interface PairRequest {
  deviceId: string
  code?: string
}

export interface AppInfo {
  id: string
  name: string
  icon?: string
}

export type Screen = 'remote' | 'devices' | 'setup'
