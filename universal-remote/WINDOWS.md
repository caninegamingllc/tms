# Clone to your Windows path

This cloud agent could not create a new GitHub repository (token lacks `createRepository`). Use either path below.

## Option A — from the artifact tarball

1. Download `universal-remote.tar.gz` from this agent’s artifacts.
2. On Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force -Path "C:\Users\fperi\cursor projects\Universal Remote" | Out-Null
cd "C:\Users\fperi\cursor projects\Universal Remote"
tar -xzf $HOME\Downloads\universal-remote.tar.gz --strip-components 1
npm install
npm --prefix bridge install
```

## Option B — your own GitHub repo

1. Create an empty repo on GitHub (for example `caninegamingllc/universal-remote`).
2. From the project folder (or after extracting the tarball):

```powershell
cd "C:\Users\fperi\cursor projects\Universal Remote"
git init
git branch -M main
git remote add origin https://github.com/<you>/universal-remote.git
git add .
git commit -m "Initial Universal Remote"
git push -u origin main
```

## Run on the home Wi‑Fi PC

```powershell
npm run bridge
npm run dev
```

On your phone, open the Vite URL, go to **Bridge**, and set the bridge URL to the printed LAN address (port `8787`).
