#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if ! node -e "if (Number(process.versions.node.split(".")[0]) < 22) process.exit(1)"; then
  echo "Node.js 22 or newer is required." >&2
  exit 1
fi
for target in apps/api/.env apps/web/.env.local; do
  if [ ! -f "$target" ]; then cp .env.example "$target"; fi
done
npm ci
npm test
npm run typecheck
npm run typecheck -w apps/web
npm run dev
