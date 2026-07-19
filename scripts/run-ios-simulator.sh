#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_PORT="${API_PORT:-4100}"

if [[ -z "${API_HOST:-}" ]]; then
  API_HOST="$(ipconfig getifaddr en0 2>/dev/null || true)"
fi
if [[ -z "${API_HOST:-}" ]]; then
  API_HOST="$(ipconfig getifaddr en1 2>/dev/null || true)"
fi
if [[ -z "${API_HOST:-}" ]]; then
  API_HOST="127.0.0.1"
fi

API_URL="${API_URL:-http://${API_HOST}:${API_PORT}/api/v1}"
DEVICE_ID="${DEVICE_ID:-iPhone 16}"
FLUTTER_ARGS=("$@")
if [[ $# -eq 0 ]]; then
  FLUTTER_ARGS=(-d "${DEVICE_ID}")
fi

echo "Using API_URL=${API_URL}"
echo "Checking API health..."
curl -fsS "${API_URL}/health" >/dev/null
echo "Launching Flutter with args: ${FLUTTER_ARGS[*]}"

cd "${ROOT_DIR}/apps/mobile"
echo "Preparing iOS simulator packages..."
flutter pub get >/dev/null

# Xcode 26 validates Swift Package platform floors more strictly. Some Flutter
# plugin packages are generated with an iOS 12-14 minimum, while the generated
# FlutterFramework package requires iOS 13+. The app target is iOS 15, so keep
# generated package floors aligned before launching the simulator.
for package_file in \
  ios/Flutter/ephemeral/Packages/.packages/*/Package.swift \
  ios/Flutter/ephemeral/Packages/FlutterGeneratedPluginSwiftPackage/Package.swift; do
  if [[ -f "${package_file}" ]]; then
    /usr/bin/perl -0pi -e 's/\.iOS\("(1[0-4])\.0"\)/.iOS("15.0")/g' "${package_file}"
  fi
done

exec flutter run \
  --no-pub \
  "${FLUTTER_ARGS[@]}" \
  --dart-define="API_URL=${API_URL}" \
  --dart-define="ELDER_TREE_LOCATION_FALLBACK=true" \
