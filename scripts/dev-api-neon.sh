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

exec npm run dev:api
