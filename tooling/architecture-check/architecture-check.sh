#!/usr/bin/env bash

set -euo pipefail

APP_DIR="${1:-.}"
APP_DIR="$(cd "$APP_DIR" && pwd)"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cd "$APP_DIR"
FAILED=0

EXCLUDES=(
  --glob '!node_modules/**'
  --glob '!dist/**'
  --glob '!coverage/**'
  --glob '!src/schemas/directus-schema.ts'
)

echo "Running architecture checks for ${APP_DIR}..."

while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  echo "❌ Directus client imported inside a component:"
  echo "$file"
  FAILED=1
done < <(rg -l "@/lib/directus/client|@directus/sdk" src --glob '*.tsx' "${EXCLUDES[@]}" 2>/dev/null || true)

SHARED_DIRS=(
  "src/components"
  "src/hooks"
  "src/config"
  "src/lib"
  "src/schemas"
  "src/stores"
  "src/types"
  "src/utils"
  "src/testing"
)

for dir in "${SHARED_DIRS[@]}"; do
  [[ -d "$dir" ]] || continue
  while IFS= read -r match; do
    [[ -z "$match" ]] && continue
    file="${match%%:*}"
    echo "❌ Shared app code imports a feature or page:"
    echo "$file"
    FAILED=1
  done < <(rg -n "@/features/|@/pages/|from ['\"].*features/|from ['\"].*pages/" "$dir" "${EXCLUDES[@]}" 2>/dev/null || true)
done

if [[ -d src/features ]]; then
  for feature_dir in src/features/*/; do
    [[ -d "$feature_dir" ]] || continue
    feature_name="$(basename "$feature_dir")"
    while IFS= read -r match; do
      [[ -z "$match" ]] && continue
      imported_feature="$(echo "$match" | rg -o "features/[^/'\"]+" | head -n 1 | cut -d/ -f2 || true)"
      if [[ -n "$imported_feature" && "$imported_feature" != "$feature_name" ]]; then
        file="${match%%:*}"
        echo "❌ Feature imports another feature:"
        echo "$file imports features/$imported_feature from features/$feature_name"
        FAILED=1
      fi
    done < <(rg -n "@/features/|from ['\"].*features/" "$feature_dir" "${EXCLUDES[@]}" 2>/dev/null || true)
  done
fi

while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  echo "❌ Query or mutation defined directly in a page:"
  echo "$file"
  FAILED=1
done < <(rg -l "useQuery|useMutation" src/pages --glob '*.tsx' "${EXCLUDES[@]}" 2>/dev/null || true)

while IFS= read -r match; do
  [[ -z "$match" ]] && continue
  echo "❌ TanStack mutation persistence used in a feature (the outbox owns durable writes):"
  echo "$match"
  FAILED=1
done < <(rg -n "resumePausedMutations|shouldDehydrateMutation|persistMutation" src/features "${EXCLUDES[@]}" 2>/dev/null || true)

while IFS= read -r match; do
  [[ -z "$match" ]] && continue
  echo "❌ Capacitor imported directly in app code (use @ld/native instead):"
  echo "$match"
  FAILED=1
done < <(rg -n "from ['\"]@capacitor/" src "${EXCLUDES[@]}" 2>/dev/null || true)

while IFS= read -r match; do
  [[ -z "$match" ]] && continue
  echo "❌ Raw connectivity check in app code (use useNetworkStatus from @ld/native/react):"
  echo "$match"
  FAILED=1
done < <(rg -n "navigator\.onLine|display-mode: standalone" src --glob '!src/features/*/api/**' "${EXCLUDES[@]}" 2>/dev/null || true)

while IFS= read -r match; do
  [[ -z "$match" ]] && continue
  echo "❌ Auth tokens must not be written to localStorage:"
  echo "$match"
  FAILED=1
done < <(rg -n "localStorage\.setItem\(['\"][^'\"]*(token|auth|session)" -i src "${EXCLUDES[@]}" 2>/dev/null || true)

while IFS= read -r match; do
  [[ -z "$match" ]] && continue
  echo "❌ Service worker registered outside @ld/pwa:"
  echo "$match"
  FAILED=1
done < <(rg -n "virtual:pwa-register|serviceWorker\.register" src "${EXCLUDES[@]}" 2>/dev/null || true)

if [[ -f "vite.config.ts" ]]; then
  while IFS= read -r match; do
    [[ -z "$match" ]] && continue
    echo "❌ Vite config bypasses createViteConfig:"
    echo "$match"
    FAILED=1
  done < <(rg -n "from ['\"]vite-plugin-pwa['\"]" vite.config.ts 2>/dev/null || true)
fi

if [[ -f "capacitor.config.ts" ]]; then
  while IFS= read -r match; do
    [[ -z "$match" ]] && continue
    echo "❌ capacitor.config.ts hardcodes server.url (use CAP_SERVER_URL for live reload only):"
    echo "$match"
    FAILED=1
  done < <(rg -n "url:\s*['\"]http" capacitor.config.ts 2>/dev/null || true)
fi

if [[ -d "$REPO_ROOT/packages/ui" ]]; then
  while IFS= read -r match; do
    [[ -z "$match" ]] && continue
    echo "❌ @ld/ui imports forbidden dependency:"
    echo "$match"
    FAILED=1
  done < <(rg -n "@ld/directus|@/features|@tanstack/react-query|zustand|@directus/sdk|@capacitor/" "$REPO_ROOT/packages/ui/src" 2>/dev/null || true)
fi

if [[ -d "$REPO_ROOT/packages/directus" ]]; then
  while IFS= read -r match; do
    [[ -z "$match" ]] && continue
    echo "❌ @ld/directus imports app code or schema:"
    echo "$match"
    FAILED=1
  done < <(rg -n "apps/|directus-schema" "$REPO_ROOT/packages/directus/src" 2>/dev/null || true)
fi

if [[ -d "$REPO_ROOT/packages/utils" ]]; then
  while IFS= read -r match; do
    [[ -z "$match" ]] && continue
    echo "❌ @ld/utils imports React or Directus:"
    echo "$match"
    FAILED=1
  done < <(rg -n "from 'react'|@directus/sdk|@ld/directus" "$REPO_ROOT/packages/utils/src" 2>/dev/null || true)
fi

if [[ -d "$REPO_ROOT/packages/forms/src" ]]; then
  while IFS= read -r match; do
    [[ -z "$match" ]] && continue
    echo "❌ @ld/forms imports forbidden dependency:"
    echo "$match"
    FAILED=1
  done < <(rg -n "@ld/directus|@directus/sdk|zustand|@tanstack/react-query" "$REPO_ROOT/packages/forms/src" 2>/dev/null || true)
fi

if [[ -d "$REPO_ROOT/packages/mobile-ui/src" ]]; then
  while IFS= read -r match; do
    [[ -z "$match" ]] && continue
    echo "❌ @ld/mobile-ui imports forbidden dependency:"
    echo "$match"
    FAILED=1
  done < <(rg -n "@ld/directus|@directus/sdk|zustand|@tanstack/react-query|@capacitor/|@ld/native|@ld/offline" "$REPO_ROOT/packages/mobile-ui/src" 2>/dev/null || true)
fi

if [[ -d "$REPO_ROOT/packages/native/src" ]]; then
  while IFS= read -r match; do
    [[ -z "$match" ]] && continue
    echo "❌ @ld/native imports forbidden dependency:"
    echo "$match"
    FAILED=1
  done < <(rg -n "@ld/directus|@directus/sdk|zustand|react-router|@ld/ui|@ld/mobile-ui" "$REPO_ROOT/packages/native/src" 2>/dev/null || true)
fi

if [[ -d "$REPO_ROOT/packages/offline/src" ]]; then
  while IFS= read -r match; do
    [[ -z "$match" ]] && continue
    echo "❌ @ld/offline imports forbidden dependency:"
    echo "$match"
    FAILED=1
  done < <(rg -n "@ld/directus|@directus/sdk|@capacitor/|@ld/native|react-router|from 'react'|@tanstack/" "$REPO_ROOT/packages/offline/src" 2>/dev/null || true)
fi

if [[ -d "$REPO_ROOT/packages/pwa/src" ]]; then
  while IFS= read -r match; do
    [[ -z "$match" ]] && continue
    echo "❌ @ld/pwa imports forbidden dependency:"
    echo "$match"
    FAILED=1
  done < <(rg -n "@ld/directus|@directus/sdk|zustand|@tanstack/|@capacitor/|@ld/native|react-router" "$REPO_ROOT/packages/pwa/src" 2>/dev/null || true)
fi

while IFS= read -r match; do
  [[ -z "$match" ]] && continue
  echo "❌ Capacitor imported outside @ld/native or @ld/config-capacitor:"
  echo "$match"
  FAILED=1
done < <(cd "$REPO_ROOT/packages" && rg -n "from ['\"]@capacitor/|from ['\"]@capawesome/" . --glob '!**/node_modules/**' --glob '!native/**' --glob '!config-capacitor/**' 2>/dev/null || true)

while IFS= read -r match; do
  [[ -z "$match" ]] && continue
  echo "❌ Shared package imports from apps:"
  echo "$match"
  FAILED=1
done < <(rg -n "apps/" "$REPO_ROOT/packages" --glob '!**/node_modules/**' --glob '!**/dist/**' 2>/dev/null || true)

while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  lines="$(wc -l < "$file" | tr -d ' ')"
  if [[ "$lines" -gt 500 ]]; then
    echo "❌ File too large:"
    echo "$file has $lines lines"
    FAILED=1
  fi
done < <(find src tests scripts -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.sh' \) \
  ! -path '*/node_modules/*' \
  ! -path '*/dist/*' \
  ! -path '*/coverage/*' \
  ! -path 'src/schemas/directus-schema.ts' 2>/dev/null || true)

if [[ "$FAILED" -ne 0 ]]; then
  echo ""
  echo "Architecture check failed."
  exit 1
fi

echo "Architecture check passed."
