# CEREBRAL OS
<img width="1536" height="1024" alt="image" src="https://github.com/user-attachments/assets/855ea245-704c-4fc4-8ff0-d7a52b89be72" />

**Cerebral OS** is a standalone desktop app for **thought-assisted AI agent orchestration**: a local-first IDE-style workspace with agent chat, composer workflows, integrated terminal, workspace file tools, optional skill marketplace integration, and optional **EMOTIV / Cortex** headset support for neural input.

- **License:** [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0)
- **Stack:** [Electron](https://www.electronjs.org/) · [Vite](https://vitejs.dev/) · React · TypeScript · SQLite (`better-sqlite3`) · secure credential storage

Cerebral OS does **not** ship a cloud backend for chat. You connect **your** models: local (Ollama, LM Studio, llama.cpp, etc.) or **your API keys** for cloud providers.

---

## Features (high level)

| Area | What you get |
|------|----------------|
| **Agents & chat** | Multi-session agent chat, composer modes (e.g. vibe / imagine / execute), tool and command flows with approvals where configured. |
| **Model providers** | Ollama, LM Studio, llama.cpp-compatible servers, OpenRouter, OpenAI, Anthropic, Google Gemini, custom OpenAI-compatible endpoints, local GGUF flows. |
| **Workspace** | Open a project folder, browse files, terminal (`node-pty`), editor tabs, workspace-scoped actions. |
| **Security** | API keys stored in the app’s secure store (OS-backed where available). **You** control which provider runs and whether “local-only” mode is on. |
| **Optional** | EMOTIV Insight / Cortex integration, skill marketplace, swarm-related UI, command encyclopedia (see in-app settings). |

---

## Requirements

| Requirement | Notes |
|-------------|--------|
| **Node.js** | **20.x** or newer (LTS recommended). |
| **npm** | Comes with Node. |
| **OS** | Developed and run on **Windows**, **macOS**, and **Linux**; native addons (`better-sqlite3`, `node-pty`) are built for your platform on `npm install`. |
| **Build tools (if install fails)** | On Windows, Visual Studio Build Tools (“Desktop development with C++”) may be required for native modules. On Linux, `build-essential` (or your distro’s equivalent). |

---

## Quick start (from source)

```bash
git clone <your-repo-url> cerebral-os
cd cerebral-os
npm install
npm run dev
```

- The **Electron window** opens automatically. This is a **desktop app**, not a generic browser session: folder pickers, terminal, and workspace APIs need the Electron shell.
- If port `5173` is busy, the Vite dev server may use another port (e.g. `5174`); the main process loads the correct URL.

**IDE deep links (hash router):** open the IDE with query flags on the hash URL, e.g. `#/cerebral/ide?providers=1` or `#/cerebral/ide?keys=1` (both focus **Providers** / model + API keys), `#/cerebral/ide?headsets=1` (focus **Headsets** and open the tab). You can combine targets that map to the same activity, e.g. `#/cerebral/ide?keys=1&providers=1`.

**Command palette:** click the **center search strip** in the top bar, or **Ctrl+Shift+P** (⌘+Shift+P on macOS) to open it — go to an activity, set session mode, open settings tabs, an agent chat, the browser, or **Welcome** (open project). The same shortcut toggles the palette closed.

**Keyboard shortcuts:** top **Settings** activity (left bar) → **Keyboard shortcuts** for an in-app table (composer, terminal, session mode, palette). Many **Ctrl+** shortcuts are also listed on the **File / Edit / View** menus; on macOS, **⌘** often applies where the UI shows **Ctrl+**. See the same section in this README under [Keyboard shortcuts](#keyboard-shortcuts).

### Linux (development)

Run from a normal user session (not a minimal container without a display). Install compiler toolchain and headers so native modules compile on `npm install`:

| Distro / env | Typical packages |
|----------------|------------------|
| **Debian / Ubuntu** | `build-essential`, `python3` (or `python-is-python3`), and often `libnss3` / `libatk` pulled in with Electron. |
| **Fedora** | `@development-tools` (or `gcc-c++` `make` `python3`) |
| **Arch** | `base-devel` `python` |

If `better-sqlite3` or `node-pty` fails to build, run `npm run rebuild:sqlite` and `npm run rebuild:pty` after ensuring the toolchain matches your Node version.

- **PTy / shell** uses your `$SHELL` or `/bin/bash` (login shell) on Linux, same as a normal terminal.
- **Packaging on Linux** (native): `npm run build:linux` produces **AppImage** and **.deb** under `release/`. On other OSes, build Linux artifacts in a Linux VM/CI, or use Dockerized `electron-builder` if you need cross-compilation.

### Production build (installers / artifacts)

```bash
npm run build
```

On the **current** OS this runs `electron-builder` with the matching targets (e.g. Windows NSIS on Windows, AppImage+deb on Linux, dmg on macOS). Outputs are under `release/` (see `package.json` → `build`).

| Command | When to use |
|---------|-------------|
| `npm run build` | Full app + installer for the **host** platform. |
| `npm run build:linux` | Linux only: AppImage + deb (run on a **Linux** machine, or a Linux CI job). |
| `npm run build:app` | Compile main/preload/renderer only (no `electron-builder`). |

### Other scripts

| Script | Purpose |
|--------|---------|
| `npm run build:app` | Build main/preload/renderer without running `electron-builder`. |
| `npm run build:linux` | On **Linux** only: AppImage + deb (see **Linux (development)** above). |
| `npm run typecheck` | TypeScript check (`tsconfig.app.json`). |
| `npm run rebuild:sqlite` / `npm run rebuild:pty` | Rebuild native modules after Node/Electron changes. |
| `npm run refresh:skills` | Regenerate bundled skills catalog (see `scripts/`). |

---

## Where to get API keys (cloud providers)

Cerebral OS **never** gives you “its own” inference key. For paid or hosted APIs, create keys in **your** accounts and paste them into the app.

| Provider | Get a key / account | Notes |
|----------|----------------------|--------|
| **OpenAI** | [OpenAI API keys](https://platform.openai.com/api-keys) | Chat Completions–compatible endpoint (default in app: `https://api.openai.com/v1/chat/completions`). |
| **Anthropic** | [Anthropic Console](https://console.anthropic.com/) | Uses the Messages API; default base path is set in provider settings. |
| **Google Gemini** | [Google AI Studio](https://aistudio.google.com/apikey) (or Google Cloud console for some setups) | Paste in provider or shared API keys UI. |
| **OpenRouter** | [OpenRouter keys](https://openrouter.ai/keys) | One key can route many models; set model id to an OpenRouter model string (e.g. `openai/gpt-4o-mini`). |

**Local / no cloud key**

| Setup | Typical URL | Key |
|--------|-------------|-----|
| **Ollama** | `http://localhost:11434/v1/chat/completions` | None (run [Ollama](https://ollama.com/) and pull a model). |
| **LM Studio** | `http://localhost:1234/v1/chat/completions` | None (start local server in LM Studio). |
| **llama.cpp server** | Often `http://localhost:8080/v1/chat/completions` | None (OpenAI-compatible server). |

---

## Keyboard shortcuts

| Where | Shortcut | Action |
|-------|----------|--------|
| **Command palette** | **Ctrl+Shift+P** (⌘+Shift+P on macOS) | Open or close the palette; also click the center “Ask, route…” strip in the top bar. |
| **Composer** | **Enter** | Send message (**Shift+Enter** = new line in the message). |
| **Composer** | **1**–**5** | When EMOTIV Insight is live (Thought / Hybrid), pick a neural candidate. |
| **Title bar** | Click **Mode** | Cycle **Manual** → **Hybrid** → **Thought**; use **?** next to **Mode** for popover help. |
| **Terminal** | **Enter** | Run the current line. |
| **Terminal** | **Ctrl+C** | Cancel the running process (when applicable). |
| **Terminal** | **Ctrl+L** | Clear the buffer. |
| **Terminal** | **↑** / **↓** | Command history. |

Menus in the app also show **Ctrl+** labels (e.g. **Ctrl+Shift+P**, **Ctrl+O**); not every entry is fully implemented. **Settings → Keyboard shortcuts** in the IDE mirrors this table with a bit more context.

---

## Configuring providers in the UI

1. Launch the app and open the **IDE** (from the welcome flow, open a workspace folder if prompted).
2. In the **activity bar** (left), choose **Providers** (model icon / “Model providers” panel).  
   - Pick a provider row to open **per-provider** settings: endpoint, model name, API key (if required), enable flag, defaults, and test actions.
3. Under **Settings** in the activity bar you can open:
   - **General settings** — workspace folder, local-only mode, guide provider, demo options, links to encyclopedia / headsets.
   - **API keys** — optional **shared** secure-store keys (OpenRouter, OpenAI, Anthropic, Gemini) for interoperability; **per-provider keys on each provider still take precedence** for orchestration when set.
   - **Local models / GGUF** — for local model registry flows exposed in-app.

Enable **Local-only mode** (in general settings) if you want to **disable in-process cloud provider usage** while still using local endpoints (Ollama, LM Studio, etc.).

---

## Data on disk (local)

Typical locations (Electron `userData`):

- **Windows:** `%APPDATA%\cerebral-os\` (e.g. SQLite DB, debug log, security directory for secrets).
- **macOS / Linux:** XDG-style or `~/Library/Application Support` equivalents per Electron rules.

Treat this machine as **trusted**: the app can run terminals, touch project files, and store keys locally.

---

## Security and trust model

Cerebral OS is a **powerful local environment** (terminal, file access, network calls to **your** configured endpoints). Only use workspaces and models you trust. Review tool-approval and permission settings in the app before driving automation on sensitive repositories.

Report security issues responsibly (add a `SECURITY.md` with contact or use [GitHub Security Advisories](https://docs.github.com/en/code-security/security-advisories) when the repo is public).

---

## Contributing

Contributions are welcome once the repo is public: issues, docs fixes, and PRs. Please:

- Match existing TypeScript/React style.
- Run `npm run typecheck` before submitting larger changes.
- For native module issues, document OS and Node/Electron versions.

---

## Third-party and bundled content

The tree may include **`third_party/`** assets (e.g. skill definitions). Redistribution terms vary; verify licenses before publishing a release. Run `npm run refresh:skills` when updating skill catalogs from supported sources.

---

## Name and branding

Product name in builds: **CEREBRAL OS** (`productName` in `package.json`). Bundle id: `com.cerebral.os`.

---

*README version aligned with Cerebral OS 0.1.x — update version numbers and release links when you tag on GitHub.*
