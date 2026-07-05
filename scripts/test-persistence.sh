#!/usr/bin/env bash
set -euo pipefail

export DATABASE_URL="$(
  npx --yes neonctl@2.30.1 connection-string \
    --database-name elder_tree \
    --role-name elder_tree_owner \
    --ssl require
)"

exec npm exec -w @elder-tree/api vitest run \
  src/store/persistent-store.service.integration.test.ts
