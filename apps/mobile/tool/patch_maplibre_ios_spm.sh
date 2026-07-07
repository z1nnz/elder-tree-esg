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

device_info_glob="$pub_cache/hosted/pub.dev"/device_info_plus-*/ios/device_info_plus/Sources/device_info_plus/FPPDeviceInfoPlusPlugin.m
for plugin_source in $device_info_glob; do
  [[ -f "$plugin_source" ]] || continue
  if grep -q "\\[info isiOSAppOnVision\\]" "$plugin_source"; then
    python3 - "$plugin_source" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
content = path.read_text()
old = """    NSNumber *isiOSAppOnVision = [NSNumber numberWithBool:NO];
    if (@available(iOS 26.1, *)) {
      isiOSAppOnVision = [NSNumber numberWithBool:[info isiOSAppOnVision]];
    }
"""
new = """    NSNumber *isiOSAppOnVision = [NSNumber numberWithBool:NO];
    SEL isiOSAppOnVisionSelector = NSSelectorFromString(@\"isiOSAppOnVision\");
    if ([info respondsToSelector:isiOSAppOnVisionSelector]) {
#pragma clang diagnostic push
#pragma clang diagnostic ignored \"-Warc-performSelector-leaks\"
      isiOSAppOnVision = [NSNumber numberWithBool:((BOOL (*)(id, SEL))[info methodForSelector:isiOSAppOnVisionSelector])(info, isiOSAppOnVisionSelector)];
#pragma clang diagnostic pop
    }
"""
if old not in content:
    raise SystemExit(f"Expected device_info_plus isiOSAppOnVision block not found in {path}")
path.write_text(content.replace(old, new))
PY
    echo "Patched $plugin_source for Xcode SDKs without NSProcessInfo.isiOSAppOnVision"
  fi
done
