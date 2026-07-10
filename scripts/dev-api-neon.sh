#!/usr/bin/env bash
set -euo pipefail

export DATABASE_URL="$(
  npx --yes neonctl@2.30.1 connection-string \
    --database-name elder_tree \
    --role-name elder_tree_owner \
    --pooled \
    --ssl require
)"
export DEMO_MODE=false
export FIREBASE_PROJECT_ID=elder-tree-esg-z1nnz
export FIREBASE_STORAGE_BUCKET="${FIREBASE_STORAGE_BUCKET:-elder-tree-esg-z1nnz.firebasestorage.app}"
export AI_VERIFIER_URL="${AI_VERIFIER_URL:-http://127.0.0.1:4400}"
export PHOTO_EVIDENCE_ENABLED="${PHOTO_EVIDENCE_ENABLED:-true}"
export PHOTO_VERIFICATION_ENABLED="${PHOTO_VERIFICATION_ENABLED:-true}"

exec npm run dev:api
