# Jarvis

Local desktop JARVIS. Inference via [LM Studio](https://lmstudio.ai) on loopback. Spoken replies via local Kokoro. Your data stays under `~/.kineto-roamies` by default.

**Repo:** [KennethAduan/local-jarvis](https://github.com/KennethAduan/local-jarvis)  
**Branch:** `main`

## License

AGPL-3.0-only ([LICENSE](LICENSE)). This codebase includes work originally published as [Roamies](https://github.com/KenKaiii/Roamies) by Ken Kai; copyright and attribution remain. Third-party components: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Product notes: [JARVIS.md](JARVIS.md).

## What it does

- JARVIS-only appearance; wake name defaults to **Hey Jarvis**
- Connects to LM Studio at `http://127.0.0.1:1234/v1` (preferred model `qwen/qwen3-4b-2507` when available)
- Text-only local models get a compact tool set (sketch, open allowlist, reminders, browser helpers)
- Local Kokoro speech on Windows; automatic updates disabled until this repo has a signed release feed

## Build

Needs Rust, Node.js 22+, [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/). On Windows use **Git Bash**.

```bash
git clone https://github.com/KennethAduan/local-jarvis.git
cd local-jarvis
cd showcase/tauri/sidecar && npm ci && npm test
cd .. && ./build.sh dev
./build.sh
```

Agent layout and safety rules: [AGENTS.md](AGENTS.md).

## Privacy and security

- [PRIVACY.md](PRIVACY.md)
- [SECURITY.md](SECURITY.md)

## Issues

[Issues on this repo](https://github.com/KennethAduan/local-jarvis/issues).  
[CONTRIBUTING.md](CONTRIBUTING.md) before a PR **here**.
