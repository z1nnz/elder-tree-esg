#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE_DIR="$ROOT_DIR/apps/mobile"

identity_name="$(
  security find-identity -v -p codesigning 2>/dev/null |
    awk -F '"' '/Apple Development/ && $0 !~ /REVOKED/ { print $2; exit }'
)"
if [[ -z "$identity_name" ]]; then
  echo "No valid Apple Development signing identity was found." >&2
  echo "Open Xcode > Settings > Accounts and create an Apple Development certificate." >&2
  exit 1
fi

development_team="${APPLE_DEVELOPMENT_TEAM:-}"
if [[ -z "$development_team" ]]; then
  development_team="$(
    security find-certificate -c "$identity_name" -p 2>/dev/null |
      openssl x509 -noout -subject -nameopt RFC2253 2>/dev/null |
      sed -n 's/.*OU=\([^,]*\).*/\1/p'
  )"
fi
if [[ -z "$development_team" ]]; then
  echo "Could not determine the Apple Development Team ID." >&2
  exit 1
fi

cd "$MOBILE_DIR"
flutter pub get
flutter build macos --debug --config-only
xcodebuild \
  -workspace macos/Runner.xcworkspace \
  -scheme Runner \
  -configuration Debug \
  -destination "platform=macOS" \
  -derivedDataPath build/macos \
  DEVELOPMENT_TEAM="$development_team" \
  CODE_SIGN_STYLE=Automatic \
  CODE_SIGN_IDENTITY="$identity_name" \
  -allowProvisioningUpdates \
  build

echo "Built signed app:"
echo "$MOBILE_DIR/build/macos/Build/Products/Debug/elder_tree_mobile.app"
