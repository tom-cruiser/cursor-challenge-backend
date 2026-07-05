# Seeding Hospitals & Vaccines

Two ways to populate the database: **direct service-role script** (fastest for dev) or **curl against the API** (tests the full auth + validation path).

---

## Backend structure (relevant parts)

```
GET  /health                          Public health check
POST /api/v1/hospital/signup          Auth required, any role (promotes user → hospital)
GET  /api/v1/hospital/profile         Auth + role: hospital
POST /api/v1/hospital/vaccines        Auth + role: hospital
```

### Auth flow

1. Client sends `Authorization: Bearer <supabase_jwt>`.
2. `authenticateToken` (`src/middleware/auth.ts`) verifies the JWT with `SUPABASE_JWT_SECRET` (HS256).
3. Phone is extracted from `phone`, `sub` (if starts with `+`), or `user_metadata.phone`.
4. User is looked up in `users` by phone; if missing, a new `parent` row is created.
5. `POST /hospital/signup` updates the user to `role: hospital` and inserts a `hospitals` row.
6. Routes after signup use `requireRole('hospital')`.

### Vaccine schema (POST body)

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | e.g. `BCG`, `Pentavalent-1` |
| `itemType` | `vaccine` \| `checkup` | |
| `ageMinMonths` | int ≥ 0 | |
| `ageMaxMonths` | int ≥ ageMin | |
| `milestoneAgeMonths` | int | Must fall within min–max |
| `doseNumber` | int ≥ 1 | Optional, default 1 |
| `purpose` | string | Optional |
| `details` | string | Optional |
| `reminderDays` | int[] | Optional, default `[3, 1]` |

Unique constraint: `(hospital_id, name, dose_number)`.

---

## Option A: Direct DB seed (no OTP, no running server)

Uses `SUPABASE_SERVICE_ROLE_KEY` from `.env` to insert users, hospitals, and vaccines.

```bash
cd cursor-challenge-backend
npx tsx scripts/seed-data.ts
```

Creates 3 Kigali-area hospitals with an 11-item Rwanda EPI-style vaccine catalog each:

| Hospital | Phone | Coordinates |
|----------|-------|-------------|
| Kigali Health Center | +250788001001 | -1.9441, 30.0619 |
| Remera Health Centre | +250788001002 | -1.9597, 30.1126 |
| Nyamata District Hospital | +250788001003 | -2.1536, 30.1234 |

Idempotent: skips existing hospitals/vaccines.

---

## Option B: curl via API (dev JWT workaround)

### Dev JWT — no Supabase OTP required

If you have `SUPABASE_JWT_SECRET` in `.env`, mint a valid token locally:

```bash
TOKEN=$(npx tsx scripts/generate-dev-jwt.ts +250788001001)
echo "$TOKEN"
```

This signs an HS256 JWT with a `phone` claim — the same secret Supabase uses. The backend accepts it without calling Supabase Auth.

> **Production:** use real Supabase phone OTP (see below). Never expose `SUPABASE_JWT_SECRET` or service role keys to clients.

### Real Supabase phone OTP (production-like)

1. Enable Phone auth in Supabase Dashboard → Authentication → Providers.
2. Request OTP from your frontend or Supabase client:

```javascript
const { data, error } = await supabase.auth.signInWithOtp({ phone: '+250788123456' });
// verify OTP
const { data: session } = await supabase.auth.verifyOtp({
  phone: '+250788123456',
  token: '123456',
  type: 'sms',
});
const jwt = session.session.access_token;
```

3. Use `jwt` as the Bearer token in curl.

### Health check

```bash
curl -s http://localhost:3000/api/v1/health | jq .
# { "status": "ok", "timestamp": "..." }
```

### Hospital signup

Each hospital needs a **unique phone** (one owner per hospital).

```bash
TOKEN=$(npx tsx scripts/generate-dev-jwt.ts +250788001001)

curl -sS -X POST http://localhost:3000/api/v1/hospital/signup \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Kigali Health Center",
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
  }' | jq .
```

Response (201):

```json
{
  "hospital": { "id": "uuid", "name": "...", ... },
  "user": { "id": "uuid", "role": "hospital", ... }
}
```

### Create vaccines

Use the **same phone/token** as signup (hospital role is now assigned).

```bash
# BCG at birth
curl -sS -X POST http://localhost:3000/api/v1/hospital/vaccines \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "BCG",
    "itemType": "vaccine",
    "ageMinMonths": 0,
    "ageMaxMonths": 1,
    "milestoneAgeMonths": 0,
    "doseNumber": 1,
    "purpose": "Tuberculosis protection",
    "details": "Given at birth",
    "reminderDays": [3, 1]
  }' | jq .

# Pentavalent (DTaP + HepB + Hib) — dose 1 at 1 month
curl -sS -X POST http://localhost:3000/api/v1/hospital/vaccines \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Pentavalent-1",
    "itemType": "vaccine",
    "ageMinMonths": 1,
    "ageMaxMonths": 2,
    "milestoneAgeMonths": 1,
    "doseNumber": 1,
    "purpose": "Combined immunization",
    "details": "DTaP, HepB, Hib — dose 1",
    "reminderDays": [3, 1]
  }' | jq .

# Measles-Rubella at 9 months
curl -sS -X POST http://localhost:3000/api/v1/hospital/vaccines \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Measles-Rubella-1",
    "itemType": "vaccine",
    "ageMinMonths": 9,
    "ageMaxMonths": 12,
    "milestoneAgeMonths": 9,
    "doseNumber": 1,
    "purpose": "Measles & rubella",
    "details": "First MR dose at 9 months",
    "reminderDays": [7, 3, 1]
  }' | jq .
```

### List vaccines

```bash
curl -sS http://localhost:3000/api/v1/hospital/vaccines \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Full automated curl script

```bash
chmod +x scripts/seed-via-curl.sh
npm run dev   # in another terminal
./scripts/seed-via-curl.sh
```

Uses separate phone numbers (`+250788001101`, `+250788001102`) so it does not conflict with `seed-data.ts`.

---

## Migration seed data

The SQL migration (`supabase/migrations/20260705100000_initial_schema.sql`) also seeds:

- **Kigali University Teaching Hospital** (+250780000001) — 9 vaccines
- **King Faisal Hospital** (+250780000002) — hospital only, no vaccines

---

## Scripts reference

| Script | Purpose |
|--------|---------|
| `scripts/generate-dev-jwt.ts` | Mint dev Bearer token from phone |
| `scripts/seed-data.ts` | Service-role direct DB seed |
| `scripts/seed-via-curl.sh` | API seed via curl + dev JWT |

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `401 Authorization token required` | Missing Bearer header | Set `Authorization: Bearer $TOKEN` |
| `401 Invalid token` | Wrong JWT secret | Match `SUPABASE_JWT_SECRET` to Supabase dashboard |
| `403 hospital role required` | Signup not done yet | Call `POST /hospital/signup` first |
| `409 Hospital account already registered` | Phone already owns a hospital | Use a new phone or seed vaccines only |
| `409 Vaccine with this name and dose already exists` | Duplicate catalog entry | Safe to ignore (idempotent) |
