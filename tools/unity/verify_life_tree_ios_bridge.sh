#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
if [[ -z "${FLUTTER_ROOT:-}" ]]; then
  FLUTTER_BIN="$(command -v flutter || true)"
  if [[ -z "${FLUTTER_BIN}" ]]; then
    echo "找不到 Flutter；請加入 PATH 或設定 FLUTTER_ROOT。" >&2
    exit 1
  fi
  FLUTTER_ROOT="$(cd "$(dirname "${FLUTTER_BIN}")/.." && pwd)"
fi
RUNNER_DIR="${REPO_ROOT}/apps/mobile/ios/Runner"
APP_DELEGATE="${RUNNER_DIR}/AppDelegate.swift"
BRIDGING_HEADER="${RUNNER_DIR}/Runner-Bridging-Header.h"
UNITY_FRAMEWORKS="${REPO_ROOT}/apps/life-tree-unity/Builds/Frameworks/iphoneos"
FLUTTER_ENGINE="${FLUTTER_ROOT}/bin/cache/artifacts/engine/ios-release/Flutter.xcframework"

if [[ ! -d "${UNITY_FRAMEWORKS}/UnityFramework.framework" ]]; then
  echo "找不到 iPhone 生命樹程式庫；請先執行 tools/unity/prepare_life_tree_ios.sh。" >&2
  exit 1
fi

xcrun swiftc \
  -parse-as-library \
  -target arm64-apple-ios15.0 \
  -sdk "$(xcrun --sdk iphoneos --show-sdk-path)" \
  -F "${FLUTTER_ENGINE}/ios-arm64" \
  -F "${UNITY_FRAMEWORKS}" \
  -Xcc -I"${RUNNER_DIR}" \
  -import-objc-header "${BRIDGING_HEADER}" \
  -typecheck "${APP_DELEGATE}"

xcrun swiftc \
  -parse-as-library \
  -target arm64-apple-ios15.0-simulator \
  -sdk "$(xcrun --sdk iphonesimulator --show-sdk-path)" \
  -F "${FLUTTER_ENGINE}/ios-arm64_x86_64-simulator" \
  -Xcc -I"${RUNNER_DIR}" \
  -import-objc-header "${BRIDGING_HEADER}" \
  -typecheck "${APP_DELEGATE}"

echo "生命樹 iOS 原生橋接與無 Unity 替代路徑皆通過型別檢查。"
