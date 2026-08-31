#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
MOBILE_DIR="${REPO_ROOT}/apps/mobile"
UNITY_EXPORT="${REPO_ROOT}/apps/life-tree-unity/Builds/Android"
APK_PATH="${MOBILE_DIR}/build/app/outputs/flutter-apk/app-debug.apk"

required_paths=(
  "${UNITY_EXPORT}/gradle.properties"
  "${UNITY_EXPORT}/unityLibrary/build.gradle"
  "${UNITY_EXPORT}/unityLibrary/src/main/AndroidManifest.xml"
  "${UNITY_EXPORT}/unityLibrary/src/main/Il2CppOutputProject/IL2CPP/build/deploy/il2cpp"
  "${UNITY_EXPORT}/unityLibrary/src/main/Il2CppOutputProject/Source/il2cppOutput/Il2CppCodeRegistration.cpp"
  "${UNITY_EXPORT}/unityLibrary/src/main/jniLibs/arm64-v8a/libunity.so"
)

for required_path in "${required_paths[@]}"; do
  if [[ ! -f "${required_path}" ]]; then
    echo "Android 生命樹程式庫不完整，缺少：${required_path}" >&2
    exit 1
  fi
done

(
  cd "${MOBILE_DIR}"
  flutter pub get
  flutter build apk --debug --no-pub
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

if ! grep -Fxq 'lib/armeabi-v7a/libflutter.so' <<< "${APK_ENTRIES}" ||
   ! grep -Fxq 'lib/x86_64/libflutter.so' <<< "${APK_ENTRIES}"; then
  echo "APK 未包含低階或非 ARM64 裝置所需的 Flutter 二維備援執行時期。" >&2
  exit 1
fi

echo "生命樹 Android 原生橋接已完成建置；單一 APK 同時包含 ARM64 Unity 與跨架構 Flutter 二維備援。"
