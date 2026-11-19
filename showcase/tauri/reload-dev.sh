#!/bin/bash
# Rebuild the sidecar (and optionally the debug binary), then restart Jarvis.
# Usage (Git Bash):
#   ./reload-dev.sh           # sidecar JS only + restart (usual after sidekick/kineto edits)
#   ./reload-dev.sh --full    # also cargo build via ./build.sh dev, then restart
#   ./reload-dev.sh --no-run  # rebuild only, do not start the app
set -euo pipefail
cd "$(dirname "$0")"

FULL=0
RUN=1
for a in "$@"; do
  case "$a" in
    --full) FULL=1 ;;
    --no-run) RUN=0 ;;
    -h|--help)
      echo "Usage: ./reload-dev.sh [--full] [--no-run]"
      echo "  (default)  bundle sidecar, kill roamies, start debug binary"
      echo "  --full     also run ./build.sh dev before start"
      echo "  --no-run   rebuild only"
      exit 0 ;;
    *) echo "Unknown flag: $a (try --help)" >&2; exit 1 ;;
  esac
done

echo "==> bundling sidecar"
./sidecar/bundle.sh

if [ "$FULL" = 1 ]; then
  echo "==> building debug binary"
  ./build.sh dev
fi

BIN="src-tauri/target/debug/roamies.exe"
case "$(uname -s)" in
  Darwin) BIN="src-tauri/target/debug/roamies" ;;
  Linux) BIN="src-tauri/target/debug/roamies" ;;
esac

if [ ! -x "$BIN" ] && [ ! -f "$BIN" ]; then
  echo "No debug binary at $BIN — run: ./build.sh dev" >&2
  exit 1
fi

# Stop first: Windows locks target/debug/sidecar while roamies.exe is running.
echo "==> stopping running Jarvis (roamies)"
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    taskkill //F //IM roamies.exe >/dev/null 2>&1 || true
    sleep 1
    ;;
  Darwin|Linux)
    pkill -f '[Rr]oamies' 2>/dev/null || true
    sleep 1
    ;;
esac

# Debug builds load resource_dir/sidecar (a copy of dist). Refresh it or Jarvis keeps the old brain.
DEBUG_SIDECAR="src-tauri/target/debug/sidecar"
if [ -d "sidecar/dist" ] && [ -d "src-tauri/target/debug" ]; then
  echo "==> refreshing $DEBUG_SIDECAR from sidecar/dist"
  rm -rf "$DEBUG_SIDECAR"
  mkdir -p "$DEBUG_SIDECAR"
  cp -R sidecar/dist/. "$DEBUG_SIDECAR/"
fi

if [ "$RUN" = 0 ]; then
  echo "==> done (not starting)"
  exit 0
fi

echo "==> starting $BIN"
if [[ "$(uname -s)" == MINGW* || "$(uname -s)" == MSYS* || "$(uname -s)" == CYGWIN* ]]; then
  # Detach so this shell stays usable.
  cmd //C start "" "$(cygpath -w "$PWD/$BIN" 2>/dev/null || echo "$PWD/$BIN")"
else
  nohup "$BIN" >/dev/null 2>&1 &
fi
echo "==> reloaded"
