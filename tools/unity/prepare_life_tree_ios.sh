#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
UNITY_PROJECT="${REPO_ROOT}/apps/life-tree-unity"
UNITY_EDITOR="${UNITY_EDITOR:-/Applications/Unity/Hub/Editor/6000.0.82f1/Unity.app/Contents/MacOS/Unity}"
EXPORT_DIR="${UNITY_PROJECT}/Builds/iOS"
DERIVED_DIR="${UNITY_PROJECT}/Builds/iOS-derived"
FRAMEWORK_DIR="${DERIVED_DIR}/Build/Products/Release-iphoneos"
STAGED_FRAMEWORK_DIR="${UNITY_PROJECT}/Builds/Frameworks/iphoneos"
LOCAL_CONFIG="${REPO_ROOT}/apps/mobile/ios/Flutter/LifeTreeUnity.local.xcconfig"
UNITY_LOG="${TMPDIR:-/tmp}/tree-companion-unity-ios-export.log"
XCODE_LOG="${TMPDIR:-/tmp}/tree-companion-unity-ios-build.log"

if [[ ! -x "${UNITY_EDITOR}" ]]; then
  echo "找不到 Unity 編輯器：${UNITY_EDITOR}" >&2
  exit 1
fi

if [[ ! -d "$(dirname "${UNITY_EDITOR}")/../../../PlaybackEngines/iOSSupport" ]]; then
  echo "尚未安裝 Unity iOS Build Support。" >&2
  exit 1
fi

"${UNITY_EDITOR}" \
  -batchmode \
  -quit \
  -projectPath "${UNITY_PROJECT}" \
  -executeMethod TreeCompanion.Editor.LifeTreeSceneBuilder.ExportIosLibrary \
  -logFile "${UNITY_LOG}"

if ! xcodebuild \
  -project "${EXPORT_DIR}/Unity-iPhone.xcodeproj" \
  -target UnityFramework \
  -configuration Release \
  -sdk iphoneos \
  SYMROOT="${DERIVED_DIR}/Build/Products" \
  OBJROOT="${DERIVED_DIR}/Build/Intermediates.noindex" \
  SUPPORTS_MACCATALYST=NO \
  CODE_SIGNING_ALLOWED=NO \
  build > "${XCODE_LOG}" 2>&1; then
  tail -n 160 "${XCODE_LOG}" >&2
  exit 1
fi

if [[ ! -d "${FRAMEWORK_DIR}/UnityFramework.framework" ]]; then
  echo "UnityFramework.framework 建置完成後仍找不到。" >&2
  exit 1
fi

mkdir -p "${STAGED_FRAMEWORK_DIR}"
/usr/bin/ditto \
  "${FRAMEWORK_DIR}/UnityFramework.framework" \
  "${STAGED_FRAMEWORK_DIR}/UnityFramework.framework"

printf '%s\n' \
  "LIFE_TREE_UNITY_FRAMEWORK_DIR = ${STAGED_FRAMEWORK_DIR}" \
  'FRAMEWORK_SEARCH_PATHS[sdk=iphoneos*] = $(inherited) "$(LIFE_TREE_UNITY_FRAMEWORK_DIR)"' \
  'OTHER_LDFLAGS[sdk=iphoneos*] = $(inherited) -framework UnityFramework' \
  'LD_RUNPATH_SEARCH_PATHS[sdk=iphoneos*] = $(inherited) @executable_path/Frameworks' \
  > "${LOCAL_CONFIG}"

# Keep the staged framework, but reclaim multi-gigabyte compiler intermediates.
if ! xcodebuild \
  -project "${EXPORT_DIR}/Unity-iPhone.xcodeproj" \
  -target UnityFramework \
  -configuration Release \
  -sdk iphoneos \
  SYMROOT="${DERIVED_DIR}/Build/Products" \
  OBJROOT="${DERIVED_DIR}/Build/Intermediates.noindex" \
  SUPPORTS_MACCATALYST=NO \
  CODE_SIGNING_ALLOWED=NO \
  clean >> "${XCODE_LOG}" 2>&1; then
  echo "提醒：Unity iOS 中間物未能自動清理，可稍後重新執行腳本。" >&2
fi

if [[ -d "${EXPORT_DIR}" ]]; then
  rm -R -- "${EXPORT_DIR}"
fi
if [[ -d "${DERIVED_DIR}" ]]; then
  rm -R -- "${DERIVED_DIR}"
fi

echo "生命樹 iOS 程式庫已就緒：${STAGED_FRAMEWORK_DIR}/UnityFramework.framework"
echo "本機連結設定已寫入：${LOCAL_CONFIG}"
