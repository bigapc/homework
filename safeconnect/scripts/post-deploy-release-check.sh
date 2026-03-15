#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# SafeConnect post-deploy release smoke check
# Usage: PROD_URL=https://... npm run smoke:release
# Optionally set VERCEL_BYPASS_TOKEN to skip auto-detection.
# ---------------------------------------------------------------------------

if [[ -z "${PROD_URL:-}" ]]; then
  echo "PROD_URL is required"
  echo "Example: PROD_URL=https://your-safeconnect.vercel.app npm run smoke:release"
  exit 1
fi

BASE="${PROD_URL%/}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# ---------------------------------------------------------------------------
# Resolve bypass token
# Priority: VERCEL_BYPASS_TOKEN env var → auto-detect via Vercel CLI config
# ---------------------------------------------------------------------------
BYPASS_TOKEN="${VERCEL_BYPASS_TOKEN:-}"

if [[ -z "$BYPASS_TOKEN" ]]; then
  AUTH_FILE="${HOME}/.local/share/com.vercel.cli/auth.json"
  PROJECT_FILE="${PROJECT_ROOT}/.vercel/project.json"

  if [[ -f "$AUTH_FILE" && -f "$PROJECT_FILE" ]]; then
    CLI_TOKEN=$(python3 -c "import json; print(json.load(open('$AUTH_FILE'))['token'])" 2>/dev/null || true)
    PROJ_ID=$(python3 -c "import json; print(json.load(open('$PROJECT_FILE'))['projectId'])" 2>/dev/null || true)
    ORG_ID=$(python3 -c "import json; print(json.load(open('$PROJECT_FILE')).get('orgId',''))" 2>/dev/null || true)

    if [[ -n "$CLI_TOKEN" && -n "$PROJ_ID" ]]; then
      BYPASS_TOKEN=$(curl -sSf \
        -H "Authorization: Bearer $CLI_TOKEN" \
        "https://api.vercel.com/v9/projects/$PROJ_ID?teamId=$ORG_ID" \
        | python3 -c "
import json, sys
d = json.load(sys.stdin)
keys = list(d.get('protectionBypass', {}).keys())
print(keys[0] if keys else '')
" 2>/dev/null || true)
      [[ -n "$BYPASS_TOKEN" ]] && echo "(auto-detected protection bypass token)"
    fi
  fi
fi

# Build curl base args
CURL_ARGS=(-sS)
if [[ -n "$BYPASS_TOKEN" ]]; then
  CURL_ARGS+=(-H "x-vercel-protection-bypass: $BYPASS_TOKEN")
else
  echo "Warning: no bypass token — deployment protection may block requests"
fi

fetch_body() {
  curl "${CURL_ARGS[@]}" "$1"
}

fetch_code() {
  curl "${CURL_ARGS[@]}" -o /dev/null -w '%{http_code}' "$1"
}

# ---------------------------------------------------------------------------
echo "1) Checking health endpoint"
HEALTH_JSON="$(fetch_body "$BASE/api/health")"
echo "$HEALTH_JSON"

HEALTH_JSON="$HEALTH_JSON" node -e '
const payload = JSON.parse(process.env.HEALTH_JSON || "{}");
if (payload.status !== "ok") {
  console.error("Health status is not \"ok\":", JSON.stringify(payload));
  process.exit(1);
}
console.log("Health check passed (status=ok)");
'

# Warn about unconfigured services (informational only — does not fail)
HEALTH_JSON="$HEALTH_JSON" node -e '
const env = JSON.parse(process.env.HEALTH_JSON || "{}").env || {};
const missing = Object.entries(env).filter(([,v]) => !v).map(([k]) => k);
if (missing.length) {
  console.log("Warning: unconfigured env vars (set in Vercel before going live):");
  missing.forEach(k => console.log("  -", k));
}
'

SUPABASE_PUBLIC_CONFIGURED="$(HEALTH_JSON="$HEALTH_JSON" node -e '
const env = JSON.parse(process.env.HEALTH_JSON || "{}").env || {};
process.stdout.write(env.supabasePublicConfigured ? "1" : "0");
')"

SERVICE_ROLE_CONFIGURED="$(HEALTH_JSON="$HEALTH_JSON" node -e '
const env = JSON.parse(process.env.HEALTH_JSON || "{}").env || {};
process.stdout.write(env.serviceRoleConfigured ? "1" : "0");
')"

# ---------------------------------------------------------------------------
echo "2) Checking public pages"
for path in / /login /signup; do
  code="$(fetch_code "$BASE$path")"
  if [[ "$code" != "200" ]]; then
    echo "FAIL $path -> $code (expected 200)"
    exit 1
  fi
  echo "OK   $path -> $code"
done

# ---------------------------------------------------------------------------
echo "3) Checking protected route redirects"
DASH_CODE="$(fetch_code "$BASE/dashboard")"
if [[ "$SUPABASE_PUBLIC_CONFIGURED" != "1" ]]; then
  if [[ "$DASH_CODE" == "500" ]]; then
    echo "SKIP /dashboard strict check -> $DASH_CODE (Supabase public env not configured)"
  elif [[ "$DASH_CODE" =~ ^(2|3)[0-9][0-9]$ ]]; then
    echo "OK   /dashboard -> $DASH_CODE"
  else
    echo "FAIL /dashboard -> $DASH_CODE (expected 500, 2xx, or 3xx while Supabase env is unset)"
    exit 1
  fi
else
  # Auth middleware should redirect (3xx) or return 200 after SSR redirect
  if [[ ! "$DASH_CODE" =~ ^(2|3)[0-9][0-9]$ ]]; then
    echo "FAIL /dashboard -> $DASH_CODE (expected 2xx or 3xx)"
    exit 1
  fi
  echo "OK   /dashboard -> $DASH_CODE"
fi

# ---------------------------------------------------------------------------
echo "4) Checking auth-required API protection"
KEYS_CODE="$(curl "${CURL_ARGS[@]}" -o /dev/null -w '%{http_code}' -X POST "$BASE/api/admin/encryption/keys")"
if [[ "$SUPABASE_PUBLIC_CONFIGURED" != "1" || "$SERVICE_ROLE_CONFIGURED" != "1" ]]; then
  if [[ "$KEYS_CODE" == "200" ]]; then
    echo "FAIL /api/admin/encryption/keys -> $KEYS_CODE (unexpected success with missing env vars)"
    exit 1
  fi
  echo "OK   /api/admin/encryption/keys -> $KEYS_CODE (relaxed check: env vars missing)"
else
  if [[ "$KEYS_CODE" != "401" && "$KEYS_CODE" != "403" ]]; then
    echo "FAIL /api/admin/encryption/keys -> $KEYS_CODE (expected 401 or 403)"
    exit 1
  fi
  echo "OK   /api/admin/encryption/keys -> $KEYS_CODE"
fi

STRIPE_CODE="$(curl "${CURL_ARGS[@]}" -o /dev/null -w '%{http_code}' \
  -X POST "$BASE/api/stripe/create-checkout" \
  -H 'Content-Type: application/json' \
  --data '{"exchangeId":"test","amountCents":1000}')"
if [[ "$STRIPE_CODE" != "401" && "$STRIPE_CODE" != "503" ]]; then
  echo "FAIL /api/stripe/create-checkout -> $STRIPE_CODE (expected 401 or 503)"
  exit 1
fi
echo "OK   /api/stripe/create-checkout -> $STRIPE_CODE"

# ---------------------------------------------------------------------------
echo ""
echo "All release smoke checks passed ✓"
