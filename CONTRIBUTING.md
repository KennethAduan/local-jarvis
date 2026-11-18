# Contributing

This repository is **Jarvis** (`KennethAduan/local-jarvis`). Work lands on `main`.

Do **not** open pull requests against [KenKaiii/Roamies](https://github.com/KenKaiii/Roamies) for this project.

## Setup

With Rust, Node.js 22+, the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) and, on macOS, the Xcode Command Line Tools installed:

```bash
git clone https://github.com/KennethAduan/local-jarvis.git
cd local-jarvis
cd showcase/tauri
(cd sidecar && npm ci && npm test)
./build.sh dev
```

On Windows, run these in **Git Bash** (from [Git for Windows](https://git-scm.com/download/win)), not PowerShell or Command Prompt.

## Before you open a pull request

- Target **this** repo and `main`.
- Run `npm test` in `showcase/tauri/sidecar`.
- Keep CI (`.github/workflows/ci.yml`) green.
- Keep pull requests small and focused.

## The safety rule

Every tool that touches files, commands, URLs or other apps goes through `showcase/tauri/sidecar/safety.mjs`. Add a test case in `showcase/tauri/sidecar/test/safety.test.mjs` with every rule change.

## Security problems

Do not open a public issue. Report as described in [SECURITY.md](SECURITY.md).
