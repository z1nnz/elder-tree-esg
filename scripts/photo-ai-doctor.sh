#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export PHOTO_EVIDENCE_ENABLED="${PHOTO_EVIDENCE_ENABLED:-true}"
export PHOTO_VERIFICATION_ENABLED="${PHOTO_VERIFICATION_ENABLED:-true}"
export FIREBASE_STORAGE_BUCKET="${FIREBASE_STORAGE_BUCKET:-elder-tree-esg-z1nnz.firebasestorage.app}"
export AI_VERIFIER_URL="${AI_VERIFIER_URL:-http://127.0.0.1:4400}"
export API_URL="${API_URL:-http://127.0.0.1:4100/api/v1}"

node scripts/check-photo-ai-validation.mjs
