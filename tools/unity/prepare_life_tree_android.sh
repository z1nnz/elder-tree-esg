#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
UNITY_PROJECT="${REPO_ROOT}/apps/life-tree-unity"
UNITY_EDITOR="${UNITY_EDITOR:-/Applications/Unity/Hub/Editor/6000.0.82f1/Unity.app/Contents/MacOS/Unity}"
ANDROID_SUPPORT="$(cd "$(dirname "${UNITY_EDITOR}")/../../.." && pwd)/PlaybackEngines/AndroidPlayer"
EXPORT_DIR="${UNITY_PROJECT}/Builds/Android"
UNITY_LOG="${TMPDIR:-/tmp}/tree-companion-unity-android-export.log"

if [[ ! -x "${UNITY_EDITOR}" ]]; then
  echo "找不到 Unity 編輯器：${UNITY_EDITOR}" >&2
  exit 1
fi

if [[ ! -d "${ANDROID_SUPPORT}" ]]; then
  echo "尚未安裝 Unity Android Build Support。" >&2
  exit 1
fi

"${UNITY_EDITOR}" \
  -batchmode \
  -quit \
  -projectPath "${UNITY_PROJECT}" \
  -executeMethod TreeCompanion.Editor.LifeTreeSceneBuilder.ExportAndroidLibrary \
  -logFile "${UNITY_LOG}"

required_paths=(
  "${EXPORT_DIR}/gradle.properties"
  "${EXPORT_DIR}/shared/keepUnitySymbols.gradle"
  "${EXPORT_DIR}/unityLibrary/build.gradle"
  "${EXPORT_DIR}/unityLibrary/libs/unity-classes.jar"
  "${EXPORT_DIR}/unityLibrary/src/main/java/com/unity3d/player/UnityPlayerGameActivity.java"
  "${EXPORT_DIR}/unityLibrary/src/main/jniLibs/arm64-v8a/libunity.so"
)

for required_path in "${required_paths[@]}"; do
  if [[ ! -e "${required_path}" ]]; then
    echo "Android 生命樹程式庫缺少：${required_path}" >&2
    exit 1
  fi
done

echo "生命樹 Android 程式庫已就緒：${EXPORT_DIR}/unityLibrary"
echo "Flutter Android 建置會自動偵測並嵌入此本機程式庫。"
