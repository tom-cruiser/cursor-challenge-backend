#!/usr/bin/env bash
# Seed hospitals and vaccines via the REST API using dev JWTs (no Supabase OTP).
#
# Prerequisites:
#   - Backend running: npm run dev  (http://localhost:3000)
#   - .env with SUPABASE_JWT_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
#
# Usage:
#   ./scripts/seed-via-curl.sh
#   BASE_URL=http://localhost:3000 ./scripts/seed-via-curl.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE_URL="${BASE_URL:-http://localhost:3000}"
API="${BASE_URL}/api/v1"

cd "$ROOT"

echo "=== Health check ==="
curl -sS "${BASE_URL}/api/v1/health" | jq .

mint_token() {
  local phone="$1"
  npx tsx scripts/generate-dev-jwt.ts "$phone" 2>/dev/null
}

signup_hospital() {
  local phone="$1"
  local payload="$2"
  local token
  token="$(mint_token "$phone")"

  echo ""
  echo "=== Hospital signup: $phone ==="
  curl -sS -X POST "${API}/hospital/signup" \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json" \
    -d "$payload" | jq .
}

create_vaccine() {
  local phone="$1"
  local payload="$2"
  local token
  token="$(mint_token "$phone")"

  curl -sS -X POST "${API}/hospital/vaccines" \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json" \
    -d "$payload" | jq -c '{ name: .vaccine.name, id: .vaccine.id }'
}

# --- Hospital 1: Kigali Health Center ---
H1_PHONE="+250788001101"
H1_PAYLOAD='{
  "name": "Kigali Health Center (curl)",
  "address": "KN 4 Ave, Nyarugenge, Kigali",
  "latitude": -1.9441,
  "longitude": 30.0619,
  "helpPhone": "+250788123456",
  "country": "Rwanda",
  "services": ["vaccination", "pediatrics", "general"],
  "operatingHours": {
    "monday":    {"open": "08:00", "close": "17:00", "vaccination": true},
    "tuesday":   {"open": "08:00", "close": "17:00", "vaccination": true},
    "wednesday": {"open": "08:00", "close": "17:00", "vaccination": true},
    "thursday":  {"open": "08:00", "close": "17:00", "vaccination": true},
    "friday":    {"open": "08:00", "close": "17:00", "vaccination": true},
    "saturday":  {"open": "08:00", "close": "12:00", "vaccination": true},
    "sunday":    {"open": null, "close": null, "vaccination": false}
  }
}'

signup_hospital "$H1_PHONE" "$H1_PAYLOAD" || true

echo ""
echo "=== Vaccines for $H1_PHONE ==="
create_vaccine "$H1_PHONE" '{"name":"BCG","itemType":"vaccine","ageMinMonths":0,"ageMaxMonths":1,"milestoneAgeMonths":0,"doseNumber":1,"purpose":"Tuberculosis protection","details":"Given at birth","reminderDays":[3,1]}'
create_vaccine "$H1_PHONE" '{"name":"OPV-0","itemType":"vaccine","ageMinMonths":0,"ageMaxMonths":1,"milestoneAgeMonths":0,"doseNumber":1,"purpose":"Polio prevention","details":"Oral polio at birth","reminderDays":[3,1]}'
create_vaccine "$H1_PHONE" '{"name":"Pentavalent-1","itemType":"vaccine","ageMinMonths":1,"ageMaxMonths":2,"milestoneAgeMonths":1,"doseNumber":1,"purpose":"Combined immunization","details":"DTaP, HepB, Hib dose 1","reminderDays":[3,1]}'
create_vaccine "$H1_PHONE" '{"name":"Measles-Rubella-1","itemType":"vaccine","ageMinMonths":9,"ageMaxMonths":12,"milestoneAgeMonths":9,"doseNumber":1,"purpose":"Measles & rubella","details":"First MR dose","reminderDays":[7,3,1]}'

# --- Hospital 2: Remera Health Centre ---
H2_PHONE="+250788001102"
H2_PAYLOAD='{
  "name": "Remera Health Centre (curl)",
  "address": "KG 11 Ave, Remera, Kigali",
  "latitude": -1.9597,
  "longitude": 30.1126,
  "helpPhone": "+250788234567",
  "country": "Rwanda",
  "services": ["vaccination", "maternity"],
  "operatingHours": {
    "monday":    {"open": "07:30", "close": "18:00", "vaccination": true},
    "tuesday":   {"open": "07:30", "close": "18:00", "vaccination": true},
    "wednesday": {"open": "07:30", "close": "18:00", "vaccination": true},
    "thursday":  {"open": "07:30", "close": "18:00", "vaccination": true},
    "friday":    {"open": "07:30", "close": "18:00", "vaccination": true},
    "saturday":  {"open": "09:00", "close": "13:00", "vaccination": true},
    "sunday":    {"open": null, "close": null, "vaccination": false}
  }
}'

signup_hospital "$H2_PHONE" "$H2_PAYLOAD" || true

echo ""
echo "=== Vaccines for $H2_PHONE ==="
create_vaccine "$H2_PHONE" '{"name":"BCG","itemType":"vaccine","ageMinMonths":0,"ageMaxMonths":1,"milestoneAgeMonths":0,"doseNumber":1,"purpose":"Tuberculosis protection","details":"Given at birth","reminderDays":[3,1]}'
create_vaccine "$H2_PHONE" '{"name":"Pentavalent-1","itemType":"vaccine","ageMinMonths":1,"ageMaxMonths":2,"milestoneAgeMonths":1,"doseNumber":1,"purpose":"Combined immunization","details":"DTaP dose 1","reminderDays":[3,1]}'
create_vaccine "$H2_PHONE" '{"name":"Pentavalent-2","itemType":"vaccine","ageMinMonths":2,"ageMaxMonths":3,"milestoneAgeMonths":2,"doseNumber":1,"purpose":"Combined immunization","details":"DTaP dose 2","reminderDays":[3,1]}'

echo ""
echo "Done. List vaccines: curl -H \"Authorization: Bearer \$(npx tsx scripts/generate-dev-jwt.ts $H1_PHONE)\" ${API}/hospital/vaccines | jq ."
