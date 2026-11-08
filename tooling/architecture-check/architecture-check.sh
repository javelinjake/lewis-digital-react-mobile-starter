#!/usr/bin/env bash
# Architecture rules for one workspace. Run from a package script: `bash <path>/architecture-check.sh .`
# Uses plain grep so it behaves the same on a laptop and on a CI runner (no ripgrep required).

set -euo pipefail

APP_DIR="${1:-.}"
APP_DIR="$(cd "$APP_DIR" && pwd)"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cd "$APP_DIR"
FAILED=0
# report() often runs in a pipeline subshell, so failures are recorded in a file as well as in FAILED.
FAIL_FILE="$(mktemp)"
trap 'rm -f "$FAIL_FILE"' EXIT

EXCLUDES=(
  --exclude-dir=node_modules
  --exclude-dir=dist
  --exclude-dir=coverage
  --exclude-dir=.next
  --exclude-dir=migrations
  --exclude-dir=ios
  --exclude-dir=android
  --exclude-dir=.trapeze
  --exclude-dir=dev-dist
  --exclude-dir=test-results
  --exclude=payload-types.ts
  --exclude=importMap.js
)

# report "message": reads matches on stdin; prints them under the message and marks the run failed.
report() {
  local message="$1" output
  output="$(cat)"
  if [[ -n "$output" ]]; then
    echo "❌ ${message}"
    echo "$output"
    echo "$message" >> "$FAIL_FILE"
    FAILED=1
  fi
}

# scan "message" "pattern" dir...: fail when the extended regex matches in any of the dirs.
scan() {
  local message="$1" pattern="$2"
  shift 2
  local dirs=()
  local dir
  for dir in "$@"; do
    [[ -e "$dir" ]] && dirs+=("$dir")
  done
  [[ ${#dirs[@]} -eq 0 ]] && return 0
  report "$message" < <(grep -rnE "$pattern" "${dirs[@]}" "${EXCLUDES[@]}" 2>/dev/null || true)
}

echo "Running architecture checks for ${APP_DIR}..."

# ---------------------------------------------------------------------------
# Client apps (Vite + React + Capacitor): anything with a src/ and a vite.config.ts
# ---------------------------------------------------------------------------
if [[ -f vite.config.ts && -d src ]]; then
  { grep -rnE "@/lib/api/client|@ld/api-client|better-auth" src --include='*.tsx' "${EXCLUDES[@]}" 2>/dev/null | grep -vE "import type" || true; } \
    | report "API or auth client imported inside a component (go through a feature api/ or lib/ module)"

  for dir in src/components src/hooks src/config src/lib src/schemas src/stores src/types src/utils src/testing; do
    [[ -d "$dir" ]] || continue
    scan "Shared app code imports a feature or page" "@/features/|@/pages/|from ['\"].*features/|from ['\"].*pages/" "$dir"
  done

  if [[ -d src/features ]]; then
    for feature_dir in src/features/*/; do
      [[ -d "$feature_dir" ]] || continue
      feature_name="$(basename "$feature_dir")"
      while IFS= read -r match; do
        [[ -z "$match" ]] && continue
        content="${match#*:}"
        content="${content#*:}"
        imported_feature="$(echo "$content" | grep -oE "features/[^/'\"]+" | head -n 1 | cut -d/ -f2 || true)"
        if [[ -n "$imported_feature" && "$imported_feature" != "$feature_name" ]]; then
          echo "❌ Feature imports another feature:"
          echo "${match%%:*} imports features/$imported_feature from features/$feature_name"
          FAILED=1
        fi
      done < <(grep -rnE "@/features/|from ['\"].*features/" "$feature_dir" "${EXCLUDES[@]}" 2>/dev/null || true)
    done
  fi

  { grep -rlE "useQuery|useMutation" src/pages --include='*.tsx' "${EXCLUDES[@]}" 2>/dev/null || true; } \
    | report "Query or mutation defined directly in a page (put it in a feature)"

  scan "TanStack mutation persistence used in a feature (the outbox owns durable writes)" \
    "resumePausedMutations|shouldDehydrateMutation|persistMutation" src/features

  scan "Capacitor imported directly in app code (use @ld/native instead)" \
    "from ['\"]@capacitor/|from ['\"]@capacitor-community/|from ['\"]@capawesome|from ['\"]@revenuecat/" src

  { grep -rnE "navigator\.onLine|display-mode: standalone" src "${EXCLUDES[@]}" 2>/dev/null | grep -vE "^src/features/[^/]+/api/" || true; } \
    | report "Raw connectivity check in app code (use useNetworkStatus from @ld/native/react)"

  { grep -rniE "localStorage\.setItem\(['\"][^'\"]*(token|auth|session)" src "${EXCLUDES[@]}" 2>/dev/null || true; } \
    | report "Auth tokens must not be written to localStorage"

  scan "Service worker registered outside @ld/pwa" "virtual:pwa-register|serviceWorker\.register" src

  scan "Backend code imported into a client app (only 'import type' from the app's api package is allowed)" \
    "from ['\"](payload|@payloadcms/|@ld/backend|better-auth/(node|adapters|plugins))" src

  { grep -rnE "@ld/api-[a-z0-9-]+" src "${EXCLUDES[@]}" 2>/dev/null | grep -vE "@ld/api-client|import type|export type" || true; } \
    | report "Only 'import type' is allowed from an api package"

  scan "Secret-looking value read from import.meta.env (VITE_ values are public and end up in the bundle)" \
    "import\.meta\.env\.VITE_[A-Z0-9_]*(SECRET|TOKEN|PASSWORD|PRIVATE)" src

  for env_file in .env .env.*; do
    [[ -f "$env_file" ]] || continue
    report "VITE_ variables are shipped to every user. Secrets belong in the api app's environment (${env_file})" < <(
      grep -nE "^VITE_[A-Z0-9_]*(SECRET|TOKEN|PASSWORD|PRIVATE)[A-Z0-9_]*=." "$env_file" 2>/dev/null || true
    )
  done

  if [[ -f vite.config.ts ]]; then
    report "Vite config bypasses createViteConfig" < <(
  grep -nE "from ['\"]vite-plugin-pwa['\"]" vite.config.ts 2>/dev/null || true;
)
  fi

  if [[ -f capacitor.config.ts ]]; then
    report "capacitor.config.ts hardcodes server.url (use CAP_SERVER_URL for live reload only)" < <(
  grep -nE "url:\s*['\"]http" capacitor.config.ts 2>/dev/null || true;
)
  fi
fi

# ---------------------------------------------------------------------------
# API apps (Next + Payload): anything with a payload.config.ts
# ---------------------------------------------------------------------------
if [[ -f payload.config.ts ]]; then
  if [[ -d cms/collections ]]; then
    for file in cms/collections/*.ts; do
      [[ -f "$file" ]] || continue
      if ! grep -qE "ownedCollection\(|architecture: public-data" "$file"; then
        echo "❌ Collection must use ownedCollection(), or carry the marker '// architecture: public-data' if it holds no user data:"
        echo "$file"
        FAILED=1
      fi
    done
  fi

  { grep -rlE "'use client'|\"use client\"" app --include='*.ts' --include='*.tsx' "${EXCLUDES[@]}" 2>/dev/null \
      | xargs grep -lE "from ['\"](payload|@payloadcms/db-|@ld/backend)" 2>/dev/null \
      | xargs grep -L "architecture: admin-only" 2>/dev/null || true; } \
    | report "Client components must not import Payload or @ld/backend (unless marked 'architecture: admin-only')"

  { grep -rnE "NEXT_PUBLIC_[A-Z0-9_]*(SECRET|TOKEN|PASSWORD|PRIVATE)" . "${EXCLUDES[@]}" --include='*.ts' --include='*.tsx' --include='.env*' 2>/dev/null || true; } \
    | report "NEXT_PUBLIC_ values are public. Never put secrets there"
fi

# ---------------------------------------------------------------------------
# core packages (apps/<slug>/core): pure logic shared by the app and its api
# ---------------------------------------------------------------------------
if [[ "$(basename "$APP_DIR")" == "core" && -d src ]]; then
  scan "core packages are pure TypeScript. No React, Capacitor, Payload, browser or Node-only imports" \
    "from ['\"](react|react-dom|react-router|@capacitor/|payload|@payloadcms/|@ld/backend|@ld/native|@ld/ui|@ld/mobile-ui|node:)" src
  # Comment lines are skipped, so a comment can explain the rule without tripping it.
  report "core packages must be deterministic. Use the seeded random from @ld/utils/random, not Math.random or Date.now()" < <(
    grep -rnE "Math\.random\(|Date\.now\(|new Date\(\)" src "${EXCLUDES[@]}" 2>/dev/null | grep -vE "^[^:]+:[0-9]+:[[:space:]]*(\*|//|/\*)" || true
  )
fi

# ---------------------------------------------------------------------------
# Shared packages (checked from every workspace, they are cheap)
# ---------------------------------------------------------------------------
PKG="$REPO_ROOT/packages"

[[ -d "$PKG/ui/src" ]] && scan "@ld/ui imports forbidden dependency" \
  "@ld/api-client|@/features|@tanstack/react-query|zustand|better-auth|payload|@capacitor/" "$PKG/ui/src"

[[ -d "$PKG/utils/src" ]] && scan "@ld/utils imports React or backend code" \
  "from 'react'|@ld/api-client|better-auth|payload" "$PKG/utils/src"

[[ -d "$PKG/forms/src" ]] && scan "@ld/forms imports forbidden dependency" \
  "@ld/api-client|better-auth|zustand|@tanstack/react-query" "$PKG/forms/src"

[[ -d "$PKG/mobile-ui/src" ]] && scan "@ld/mobile-ui imports forbidden dependency" \
  "@ld/api-client|better-auth|zustand|@tanstack/react-query|@capacitor/|@ld/native|@ld/offline" "$PKG/mobile-ui/src"

[[ -d "$PKG/native/src" ]] && scan "@ld/native imports forbidden dependency" \
  "@ld/api-client|better-auth|zustand|react-router|@ld/ui|@ld/mobile-ui" "$PKG/native/src"

[[ -d "$PKG/offline/src" ]] && scan "@ld/offline imports forbidden dependency" \
  "@ld/api-client|better-auth|@capacitor/|@ld/native|react-router|from 'react'|@tanstack/" "$PKG/offline/src"

[[ -d "$PKG/pwa/src" ]] && scan "@ld/pwa imports forbidden dependency" \
  "@ld/api-client|better-auth|zustand|@tanstack/|@capacitor/|@ld/native|react-router" "$PKG/pwa/src"

[[ -d "$PKG/api-client/src" ]] && scan "@ld/api-client imports forbidden dependency" \
  "from 'react'|react-router|zustand|@tanstack/|@capacitor/|@ld/native|@ld/backend|from ['\"]payload" "$PKG/api-client/src"

if [[ -d "$PKG" ]]; then
  report "Capacitor plugin imported outside @ld/native or @ld/config-capacitor" < <(
  (cd "$PKG" && grep -rnE "from ['\"](@capacitor/|@capacitor-community/|@capawesome|@capgo/|@revenuecat/)" . \
      --include='*.ts' --include='*.tsx' --exclude-dir=node_modules --exclude-dir=dist \
      --exclude-dir=native --exclude-dir=config-capacitor 2>/dev/null || true)
)

  report "Shared package imports from apps" < <(
  grep -rnE "from ['\"][./]*(\.\./)*apps/" "$PKG" --include='*.ts' --include='*.tsx' --exclude-dir=node_modules --exclude-dir=dist 2>/dev/null || true;
)
fi

# ---------------------------------------------------------------------------
# File size
# ---------------------------------------------------------------------------
for dir in src tests scripts app cms; do
  [[ -d "$dir" ]] || continue
  while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    lines="$(wc -l < "$file" | tr -d ' ')"
    if [[ "$lines" -gt 500 ]]; then
      echo "❌ File too large:"
      echo "$file has $lines lines"
      FAILED=1
    fi
  done < <(find "$dir" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.sh' \) \
    ! -path '*/node_modules/*' ! -path '*/dist/*' ! -path '*/coverage/*' ! -path '*/migrations/*' \
    ! -name 'payload-types.ts' ! -name 'importMap.js' 2>/dev/null || true)
done

if [[ "$FAILED" -ne 0 || -s "$FAIL_FILE" ]]; then
  echo ""
  echo "Architecture check failed."
  exit 1
fi

echo "Architecture check passed."
