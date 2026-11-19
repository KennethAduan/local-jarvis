# Jarvis

Local desktop JARVIS. Inference via [LM Studio](https://lmstudio.ai). Spoken replies via local Kokoro. Your data stays under `~/.kineto-roamies` by default.

**Repo:** [KennethAduan/local-jarvis](https://github.com/KennethAduan/local-jarvis)  
**Branch:** `main`

## License

AGPL-3.0-only ([LICENSE](LICENSE)). This codebase includes work originally published as [Roamies](https://github.com/KenKaiii/Roamies) by Ken Kai; copyright and attribution remain. Third-party components: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Product notes: [JARVIS.md](JARVIS.md).

## What it does

- JARVIS-only appearance; wake name defaults to **Hey Jarvis**
- Connects to LM Studio at `http://127.0.0.1:1234/v1` (preferred model `qwen/qwen3-4b-2507` when available)
- Text-only local models get a compact tool set (sketch, open allowlist, reminders, browser helpers)
- Local Kokoro speech on macOS and Windows. Install the voice pack from **Speaking**.
- Automatic updates are disabled until this repo has a signed release feed.

## Build

Needs Rust, Node.js 22+, [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/). On Windows use **Git Bash**.

```bash
git clone https://github.com/KennethAduan/local-jarvis.git
cd local-jarvis
cd showcase/tauri/sidecar && npm ci && npm test
cd .. && ./build.sh dev
./build.sh
```

### Development (debug binary)

Use this when iterating on the sidecar or shell. Do not run the installed release `.exe` for day-to-day coding.

**Windows: open Git Bash** (not Command Prompt or PowerShell). `bundle.sh` / `build.sh` are bash scripts.

```bash
cd showcase/tauri/sidecar
npm ci
npm run build
cd ..
./build.sh dev
./src-tauri/target/debug/roamies.exe
```

If `npm run build` still fails under npm’s Windows shell, run `bash bundle.sh` in that folder instead.

- First `./build.sh dev` is slow (voice, hands, and Kokoro helpers).
- After sidecar JS changes: `npm run build` in `showcase/tauri/sidecar`, then restart `roamies.exe`.
- Keep LM Studio’s local server on at `http://127.0.0.1:1234`.
- Quit any installed Jarvis first so helpers and data do not clash.

`./build.sh` (no `dev`) builds the release installer bundle.

### LM Studio on another computer

In LM Studio on the host PC, enable **Serve on Local Network** and start its API server. Quit any running Jarvis instance, then launch the Mac debug build from the repository root. Replace `192.168.1.42` with the PC's LAN address.

```bash
JARVIS_LMSTUDIO_URL=http://192.168.1.42:1234/v1 ./showcase/tauri/src-tauri/target/debug/roamies
```

If the server requires authentication, set `JARVIS_LMSTUDIO_API_TOKEN` in the launch environment too. Without a URL override, Jarvis uses `http://127.0.0.1:1234/v1`.

Agent layout and safety rules: [AGENTS.md](AGENTS.md).

## Privacy and security

- [PRIVACY.md](PRIVACY.md)
- [SECURITY.md](SECURITY.md)

## Issues

[Issues on this repo](https://github.com/KennethAduan/local-jarvis/issues).  
[CONTRIBUTING.md](CONTRIBUTING.md) before a PR **here**.
