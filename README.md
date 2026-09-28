# Llamalite

A cross-platform desktop application for managing local LLM inference services, built on [Tauri 2](https://tauri.app/) (React + TypeScript frontend, Rust backend) and powered by [llama.cpp](https://github.com/ggerganov/llama.cpp)'s `llama-server`.

Llamalite helps you download GGUF models from [ModelScope](https://modelscope.cn), configure and launch llama-server instances with a few clicks — quick presets for beginners, full parameter control when you need it — and monitor them with live logs, no command line required.

> 中文说明见 [README.zh-CN.md](./README.zh-CN.md)

## Features

- **Dashboard** — overview of service status, local model count / total size, and quick actions (start / stop / restart / open Web UI).
- **Service management** — create, edit and delete service configurations in two modes: **Quick configuration** (pick a local model and a usage scenario; sampling, context length, GPU offload, thread count and more are tuned to your hardware automatically) and **Advanced configuration** (adjust every llama-server parameter such as host, port, context length and GPU layers); start/stop/restart with real-time log streaming and auto-scroll.
- **Model management** — browse locally downloaded GGUF models, download models from ModelScope with progress tracking, collapsible live download logs and cancellation, search the ModelScope catalog, and inspect/download a single GGUF file from a repo.
- **Hardware info & recommendations** — read hardware stats via `sysinfo` (CPU / memory / GPU) and get VRAM-based model size recommendations.
- **Environment checker** — verifies `llama-server`, Python and the `modelscope` package are installed, and provides guided install steps.

## Tech Stack

| Layer      | Technology                                                                  |
| ---------- | --------------------------------------------------------------------------- |
| Frontend   | React 18, TypeScript, Vite 6, Ant Design 5, Zustand, TanStack React Query, React Router |
| Desktop    | Tauri 2 (plugins: shell, dialog, fs)                                        |
| Backend    | Rust (tokio, sysinfo, serde, uuid, chrono)                                  |
| ML/SDK     | llama.cpp `llama-server`, ModelScope Hub API (via bundled Python scripts)   |
| Testing    | Vitest + Testing Library (frontend), pytest (Python scripts)                |

## Architecture

Llamalite follows the standard Tauri layout:

```
llamalite/
├── src/                  # React frontend
│   ├── pages/            # Dashboard, Services, Models, Settings
│   ├── components/       # Shared UI (Sidebar, StatusBadge, ConfirmDialog, ...)
│   ├── stores/           # Zustand stores (services, models)
│   ├── hooks/            # useServiceManager, useModelDownload, ...
│   ├── layouts/          # MainLayout with sidebar + content
│   ├── types/            # Shared TypeScript types
│   └── __tests__/        # Frontend unit tests
├── src-tauri/            # Rust backend (Tauri)
│   ├── src/
│   │   ├── commands/     # #[tauri::command] handlers (service, model, settings, environment, hardware, python)
│   │   ├── models/       # Serialization structs (service, model, settings, hardware)
│   │   ├── sidecar/      # llama-server process manager (start/stop/log streaming)
│   │   └── storage/      # JSON file persistence (service/model/settings stores, catalog cache)
│   └── python/           # ModelScope helper scripts (search, download, list, cleanup)
├── llamalite-manual-zh/  # User manual (Chinese)
├── llamalite-manual-en/  # User manual (English)
└── package.json
```

Data flow highlights:

- **Service lifecycle** — the Rust `ServiceManager` (`src-tauri/src/sidecar/manager.rs`) spawns `llama-server` as a child process, tracks its PID/port/uptime, and forwards stdout/stderr as log events to the frontend over Tauri events.
- **Model downloads** — the frontend invokes a Rust command which runs `python/download_model.py`, streaming JSON progress lines back to the UI; cancellation cleans up the ModelScope cache via `cleanup_cache.py`.
- **Persistence** — services, models and settings are stored as JSON files under the app config directory (`src-tauri/src/storage/`).

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ and npm
- [Rust](https://www.rust-lang.org/tools/install) toolchain (stable)
- [llama.cpp](https://github.com/ggerganov/llama.cpp) `llama-server` binary (auto-detected from PATH, or configured in Settings)
- Python 3 with the `modelscope` package (`pip install modelscope`) for model download/search

## Getting Started

```bash
npm install

# Start the Tauri development app (launches Vite dev server + Rust app)
npm run tauri dev

# Or run the frontend in a browser only
npm run dev
```

## Build

```bash
npm run build          # type-check + build the frontend
npm run tauri build    # build a production desktop installer
```

## Test

```bash
npm run test           # run Vitest frontend tests once
npm run test:watch     # watch mode
npm run test:coverage  # coverage report
```

Python helper scripts have their own tests under `src-tauri/python/tests` (run with `pytest`).

## Versioning

`package.json` is the single source of truth for the app version. The About page reads it at build time (injected as `__APP_VERSION__`), and `src-tauri/tauri.conf.json` references the file directly, so the installer version follows automatically. The manual cover dates are stamped with the current month on every sync.

```bash
npm run version:sync         # propagate the version and refresh the manual cover date
npm run version:bump 0.3.0   # bump package.json, then propagate everywhere
```

A consistency test (`src/__tests__/version-sync.test.ts`) fails whenever any of those files drifts out of sync.

## User Manual

- 中文用户手册: [llamalite-manual-zh/llamalite-manual-zh.html](llamalite-manual-zh/llamalite-manual-zh.html)
- English User Manual: [llamalite-manual-en/llamalite-manual-en.html](llamalite-manual-en/llamalite-manual-en.html)

## License

© 2026 sumcourage. All rights reserved.
