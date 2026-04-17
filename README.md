# FocusLens

A lightweight macOS menubar productivity tracker. FocusLens runs quietly from your menu bar, records what you actually spend your time on (active app, window title, browser URL, idle/sleep state), and shows it back to you in a local React dashboard.

Everything stays on your Mac.

## Privacy

- All data is stored locally in a SQLite database under your user data directory (`~/Library/Application Support/focuslens/`).
- No telemetry. No network calls. No cloud sync.
- The app sets itself to launch at login by default — disable it in **System Settings → General → Login Items** if you don't want that.

## Requirements

- **macOS** (Apple Silicon or Intel)
- **Node.js 20+** ([nodejs.org](https://nodejs.org/) or `brew install node`)
- **Xcode Command Line Tools** — required to compile the `better-sqlite3` native module:
  ```bash
  xcode-select --install
  ```

## Quick start

```bash
git clone https://github.com/Khanquer17/focuslens.git
cd focuslens

# Installs root + renderer deps, rebuilds better-sqlite3 for Electron, builds the React renderer
npm install

# Run in dev
npm start
```

After `npm start`, look for the FocusLens icon in your menu bar (the app intentionally has no Dock icon).

## Permissions on first launch

macOS will prompt for two permissions the first time the tracker tries to read them. Grant both in **System Settings → Privacy & Security**:

| Permission | Why FocusLens needs it |
| --- | --- |
| **Accessibility** | Read the title of the frontmost window |
| **Screen Recording** | Required by macOS to read window titles in some apps, and to read the active URL from supported browsers (Safari, Chrome, Arc, etc.) |

If tracking looks empty after granting permissions, quit and relaunch the app.

## Building a `.dmg`

```bash
npm run make
```

This invokes `electron-builder` and produces a signed-for-local-use `.dmg` in `dist/`.

## Project layout

```
focuslens/
├── main/              # Electron main process
│   ├── index.js         # Entry point
│   ├── tray.js          # Menubar tray UI
│   ├── tracker/         # Active window / browser URL / idle / sleep detection
│   ├── db/              # SQLite schema + queries (better-sqlite3)
│   ├── services/        # Summary builder, metrics, notifications, categories
│   └── ipc/             # IPC handlers + preload script
├── renderer/          # React + Vite dashboard (built into renderer/dist)
├── assets/            # App icon helper
└── package.json       # Electron + electron-builder config
```

## Troubleshooting

- **`Error: Cannot find module 'better-sqlite3'` or native-module ABI mismatch** — re-run `npm run rebuild` from the project root. This rebuilds the native module against the version of Electron you have installed.
- **Blank window after opening the `.dmg`** — you're on an older build that shipped before the renderer-build fix. Pull the latest repo and rebuild:
  ```bash
  git pull
  rm -rf node_modules renderer/node_modules renderer/dist dist
  npm install
  npm run make
  ```
- **Blank window in dev (`npm start`)** — `renderer/dist` wasn't built. Run `npm run build:renderer`, then `npm start` again.
- **Tracker shows nothing** — Accessibility and/or Screen Recording permissions weren't granted. Grant them, then quit and relaunch.
- **Stale debug log** — written to `$TMPDIR/focuslens-debug.log` if you need to see what's happening.

## Contributing

PRs and issues welcome. Please open an issue describing what you'd like to change before sending a large patch.

## License

[MIT](LICENSE) © 2026 Ashish
