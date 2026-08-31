#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
MOBILE_DIR="${REPO_ROOT}/apps/mobile"
UNITY_EXPORT="${REPO_ROOT}/apps/life-tree-unity/Builds/Android"
APK_PATH="${MOBILE_DIR}/build/app/outputs/flutter-apk/app-debug.apk"

if [[ ! -d "${UNITY_EXPORT}/unityLibrary" ]]; then
  echo "找不到 Android 生命樹程式庫；請先執行 tools/unity/prepare_life_tree_android.sh。" >&2
  exit 1
fi

(
  cd "${MOBILE_DIR}"
  flutter pub get
  flutter build apk --debug --target-platform android-arm64
)

if [[ ! -f "${APK_PATH}" ]]; then
  echo "Android App 建置後找不到 APK：${APK_PATH}" >&2
  exit 1
fi

APK_ENTRIES="$(unzip -Z1 "${APK_PATH}")"

if ! grep -Fxq 'lib/arm64-v8a/libunity.so' <<< "${APK_ENTRIES}"; then
  echo "APK 未包含 ARM64 Unity 執行時期。" >&2
  exit 1
fi

if ! grep -Fxq 'lib/arm64-v8a/libil2cpp.so' <<< "${APK_ENTRIES}"; then
  echo "APK 未包含 ARM64 IL2CPP 程式庫。" >&2
  exit 1
fi

echo "生命樹 Android 原生橋接已完成建置，APK 包含 Unity 與 IL2CPP ARM64 程式庫。"
