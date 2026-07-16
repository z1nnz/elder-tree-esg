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
exec flutter run \
  "${FLUTTER_ARGS[@]}" \
  --dart-define="API_URL=${API_URL}" \
  --dart-define="ELDER_TREE_LOCATION_FALLBACK=true" \
