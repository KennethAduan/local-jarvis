# Jarvis notes

Home: [KennethAduan/local-jarvis](https://github.com/KennethAduan/local-jarvis), branch `main`.

Jarvis is this product. Source includes work originally published as Roamies; local LM Studio / Kokoro / JARVIS-only changes live here. Develop and open PRs only against this repo.

AGPL-3.0-only, attribution, and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) stay. The Node agent sidecar stays.

## Defaults

- JARVIS-only appearance. LM Studio at `http://127.0.0.1:1234/v1`; preferred model `qwen/qwen3-4b-2507`.
- Startup skips the setup guide by default; guide remains in settings.
- Text-only models: compact tools including bounded `sketch` / `clear_sketch`.
- Data: `~/.kineto-roamies` (`ROAMIES_DATA_DIR` for tests). App id `com.kineto.roamies`, product **Jarvis**, wake **Hey Jarvis**.
- Automatic updates off until this repo has a signed release feed.

## Build

See [README.md](README.md) (includes **Development (debug binary)**). Windows: Git Bash + current MSVC. `npm ci` / `npm test` in `showcase/tauri/sidecar`. Profile import after quit: `node import-profile.mjs --app-stopped --db <path>`.

macOS and Windows use local **Kokoro** speech (British George). Install the voice pack from **Speaking**. Jarvis checks the model files against SHA-256 hashes and stores them in the data directory.

### Dev run (Windows)

Use **Git Bash**, not Command Prompt or PowerShell. `build.sh` needs bash; `npm run build` calls `bash bundle.sh`.

```bash
cd showcase/tauri/sidecar && npm ci && npm run build
# if npm’s shell still breaks: bash bundle.sh
cd .. && ./build.sh dev
./src-tauri/target/debug/roamies.exe
```

After sidecar JS edits, from `showcase/tauri` in Git Bash: `./reload-dev.sh` (bundle + restart). Use `./reload-dev.sh --full` when the Rust shell also changed.

Sidecar JS change → rebuild sidecar → restart the debug binary. LM Studio at `http://127.0.0.1:1234`. Quit installed Jarvis first.
