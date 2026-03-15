#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${PROD_URL:-}" ]]; then
  echo "PROD_URL is required (example: https://homework-liart-nine.vercel.app)"
  exit 1
fi

if [[ -z "${ADMIN_API_KEY:-}" ]]; then
  echo "ADMIN_API_KEY is required"
  exit 1
fi

base="${PROD_URL%/}"
email="smoke-$(date +%s)@example.com"

echo "1) Health check"
health_json="$(curl -fsS "${base}/api/health")"
echo "$health_json"

HEALTH_JSON="$health_json" node -e '
const payload = JSON.parse(process.env.HEALTH_JSON);
if (payload.status !== "ok") {
  console.error("Health check failed");
  process.exit(1);
}
if (!payload.adminAuthEnabled) {
  console.error("adminAuthEnabled is false");
  process.exit(1);
}
'

echo "2) Create SOS"
curl -fsS -X POST "${base}/api/sos" \
  -H "Content-Type: application/json" \
  --data '{"location":"Post-deploy smoke","notes":"smoke"}' >/dev/null

echo "3) Create Check-in"
curl -fsS -X POST "${base}/api/checkin" \
  -H "Content-Type: application/json" \
  --data '{"contactName":"Smoke","duration":10,"notes":"smoke"}' >/dev/null

echo "4) Create onboarding"
curl -fsS -X POST "${base}/api/onboarding" \
  -H "Content-Type: application/json" \
  --data "{\"fullName\":\"Smoke User\",\"email\":\"${email}\",\"phone\":\"555-010-9999\"}" >/dev/null

echo "5) Admin list access"
curl -fsS "${base}/api/sos" -H "x-admin-api-key: ${ADMIN_API_KEY}" >/dev/null
curl -fsS "${base}/api/checkin" -H "x-admin-api-key: ${ADMIN_API_KEY}" >/dev/null

echo "Smoke checks passed"
