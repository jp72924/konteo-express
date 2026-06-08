#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "$script_dir/.." && pwd)"
cd "$repo_root"

if ! command -v node >/dev/null 2>&1; then
  echo "node is required for syntax checks." >&2
  exit 1
fi

echo "Checking JavaScript syntax..."
while IFS= read -r -d '' file; do
  node --check "$file"
done < <(find app -name '*.js' -print0)
node --check sw.js
node --check config.example.js

echo "Checking public configuration hygiene..."
if [[ -f config.local.js ]]; then
  echo "config.local.js exists locally; this is fine, but it must not be committed."
fi

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if git ls-files --error-unmatch config.local.js >/dev/null 2>&1; then
    echo "config.local.js is tracked by git. Remove it from the repository." >&2
    exit 1
  fi
fi

if grep -RE 'KIOSK_API_KEY[[:space:]]*:[[:space:]]*"[^<"]' \
  index.html config.example.js app sw.js manifest.json styles.css >/dev/null 2>&1; then
  echo "A real-looking KIOSK_API_KEY appears in versioned files." >&2
  exit 1
fi

echo "RetailOps Kiosk checks passed."
