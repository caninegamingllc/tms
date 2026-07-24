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

export interface DeviceRecord {
  id: string
  name: string
  platform: Platform
  host: string
  port?: number
  online?: boolean
  paired?: boolean
  meta?: Record<string, string>
}

export interface AppInfo {
  id: string
  name: string
}

export interface PlatformAdapter {
  discover(): Promise<Omit<DeviceRecord, 'id'>[]>
  isOnline(device: DeviceRecord): Promise<boolean>
  ensurePaired(device: DeviceRecord, code?: string): Promise<{ ok: boolean; message?: string; meta?: Record<string, string> }>
  send(device: DeviceRecord, action: RemoteAction, value?: string): Promise<void>
  listApps?(device: DeviceRecord): Promise<AppInfo[]>
}
