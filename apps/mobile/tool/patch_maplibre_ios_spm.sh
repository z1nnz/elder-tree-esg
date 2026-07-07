#!/usr/bin/env bash
set -euo pipefail

pub_cache="${PUB_CACHE:-$HOME/.pub-cache}"
patched=0

manifest_roots=(
  "$pub_cache/hosted/pub.dev"
  "ios/Flutter/ephemeral/Packages/.packages"
)

for root in "${manifest_roots[@]}"; do
  [[ -d "$root" ]] || continue
  while IFS= read -r manifest; do
  if grep -Eq '\.iOS\("(11|12)\.0"\)' "$manifest"; then
    python3 - "$manifest" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
content = path.read_text()
content = content.replace('.iOS("11.0")', '.iOS("13.0")')
content = content.replace('.iOS("12.0")', '.iOS("13.0")')
path.write_text(content)
PY
    echo "Patched $manifest to iOS 13.0"
    patched=1
  fi
  done < <(find "$root" -name Package.swift -type f)
done

if [[ "$patched" == "0" ]]; then
  echo "No Flutter SwiftPM iOS manifests needed patching."
fi
