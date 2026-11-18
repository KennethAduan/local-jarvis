# AGENTS.md

Jarvis (`KennethAduan/local-jarvis`, branch `main`): a Tauri 2 desktop app (Rust shell in `showcase/tauri/src-tauri`), a Node sidecar (`showcase/tauri/sidecar`), shared browser JS in `showcase/roamies`, macOS Swift helpers built by `src-tauri/build.rs`, and Windows helpers from `build.sh`: voice (`src-tauri/voice-win`), hands (`src-tauri/hands-win`), and Kokoro (`src-tauri/kokoro`, staged into `kokoro-runtime`, not committed).

Linux (beta) uses the voice helper and no hands helper. Shell code: `src-tauri/src/linux.rs`.

AGPL-3.0-only and third-party notices stay. Open PRs only against this repository.

## Commands

```sh
cd showcase/tauri/sidecar && npm ci
npm test
npm run build
cd .. && ./build.sh dev
./build.sh
```

There is no linter configured yet.

Releases: push a `v*` tag (or run `.github/workflows/release.yml`) on this repo when a Jarvis release feed exists. In-app auto-updates stay off until then.

## Rules

- Every tool that touches files, commands, URLs or other apps goes through `showcase/tauri/sidecar/safety.mjs`
  (tested in `test/safety.test.mjs`); the hands helpers also refuse apps in `HANDS_OFF`.
  Add a test case with every rule change.
- CI lives in `.github/workflows/ci.yml` and must stay green.
- Never commit with `--no-verify`.
- Never commit experiments; keep them in `.git/info/exclude`.
- Never commit secrets; signing credentials go in GitHub Actions secrets.
