# Universal Remote

Mobile-first TV remote for **Roku**, **Samsung**, **LG webOS**, and **Android / Fire TV**.

The phone UI is a PWA. Real device control goes through a small **local bridge** on a PC that shares Wi‑Fi with your TVs (browsers cannot discover or command LAN devices reliably on their own).

```
Phone PWA ──HTTP──▶ Local bridge (:8787) ──▶ TVs on LAN
```

## Clone onto Windows

See [WINDOWS.md](./WINDOWS.md) for full options. Quick path from this repo:

```powershell
cd "C:\Users\fperi\cursor projects"
git clone https://github.com/caninegamingllc/tms.git tms-tmp
New-Item -ItemType Directory -Force -Path ".\Universal Remote" | Out-Null
Copy-Item -Recurse -Force ".\tms-tmp\universal-remote\*" ".\Universal Remote\"
cd ".\Universal Remote"
npm install
npm --prefix bridge install
```

## Run

Terminal 1 — bridge (must stay on the home-network PC):

```powershell
npm run bridge
```

Note the printed `Phone URL` (for example `http://192.168.1.20:8787`).

Terminal 2 — web UI:

```powershell
npm run dev
```

Open the Vite URL on your phone (same Wi‑Fi), go to **Bridge**, paste the Phone URL, then **Devices → Scan network**.

### Production-style UI

```powershell
npm run build
npm run preview
```

## Pairing notes

| Platform | Pairing |
| --- | --- |
| Roku | None (ECP on port 8060). Enable external control in Roku settings if needed. |
| Samsung | First connect shows Allow on the TV; token is stored by the bridge. |
| LG webOS | Accept the pairing prompt on the TV; client key is stored. |
| Android / Fire TV | Prefer network ADB: enable debugging, `adb connect HOST:5555`, then Pair in the app. |

## Bridge API

- `GET /health`
- `GET /devices`
- `POST /devices/scan`
- `POST /devices` — body `{ name, platform, host, port?, meta? }`
- `DELETE /devices/:id`
- `POST /pair` — body `{ deviceId, code? }`
- `POST /command` — body `{ deviceId, action, value? }`
- `GET /devices/:id/apps`

## Project layout

- `src/` — React PWA (remote, devices, bridge setup)
- `bridge/` — Node control service + platform adapters

## Note on Lovable

Lovable MCP auth is not available in Cursor Cloud Agents, so this app was scaffolded locally with the same stack Lovable defaults to (Vite + React + TypeScript + Tailwind) plus the required LAN bridge.
