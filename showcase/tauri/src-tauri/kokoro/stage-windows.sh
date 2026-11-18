#!/usr/bin/env bash
# Build into a private directory: never put these ONNX DLLs beside another helper.
set -euo pipefail
cd "$(dirname "$0")"
if [ "$#" -ne 2 ]; then echo 'usage: stage-windows.sh <target-triple> <destination-directory>' >&2; exit 2; fi
triple="$1"
destination="$2"
case "$triple" in *-windows-*) ;; *) echo 'Windows target required' >&2; exit 2;; esac
cargo build --release --locked --target "$triple"
mkdir -p "$destination"
for file in jarvis-kokoro.exe onnxruntime.dll onnxruntime_providers_shared.dll sherpa-onnx-c-api.dll sherpa-onnx-cxx-api.dll; do
  cp "target/$triple/release/$file" "$destination/$file"
done
mkdir -p "$destination/licenses"
cp licenses/* "$destination/licenses/"
