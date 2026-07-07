#!/usr/bin/env bash
set -euo pipefail

pub_cache="${PUB_CACHE:-$HOME/.pub-cache}"
patched=0

manifest_roots=(
  "$pub_cache/hosted/pub.dev"
  "ios/Flutter/ephemeral/Packages/.packages"
  "macos/Flutter/ephemeral/Packages/.packages"
)

for root in "${manifest_roots[@]}"; do
  [[ -d "$root" ]] || continue
  while IFS= read -r manifest; do
  if grep -Eq '\.(iOS|macOS)\("(11|12|10\.14)\.0?"\)|\.macOS\("10\.14"\)' "$manifest"; then
    python3 - "$manifest" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
content = path.read_text()
content = content.replace('.iOS("11.0")', '.iOS("13.0")')
content = content.replace('.iOS("12.0")', '.iOS("13.0")')
content = content.replace('.macOS("10.14")', '.macOS("10.15")')
path.write_text(content)
PY
    echo "Patched $manifest to Flutter framework minimum deployment targets"
    patched=1
  fi
  done < <(find "$root" -name Package.swift -type f)
done

if [[ "$patched" == "0" ]]; then
  echo "No Flutter SwiftPM manifests needed patching."
fi
