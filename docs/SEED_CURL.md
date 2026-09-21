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

1. Client sends `Authorization: Bearer <jwt>`.
2. `authenticateToken` (`src/middleware/auth.ts`) verifies the JWT with `JWT_SECRET` (HS256).
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

Uses `DATABASE_URL` from `.env` to insert users, hospitals, and vaccines.

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

## Option A2: Real Kigali hospitals (8 facilities)

Seeds verified hospitals with real coordinates, 24h operating hours, and the standard EPI vaccine catalog:

```bash
cd cursor-challenge-backend
npm run seed:hospitals
```

| Hospital | Phone (owner / help) | Coordinates |
|----------|----------------------|-------------|
| King Faisal Hospital | +250788123200 | -1.9436307, 30.0953563 |
| University Teaching Hospital of Kigali (CHUK) | +250788304005 | -1.9559588, 30.0604352 |
| WIWO Specialized Hospital | +250733444444 | -1.9440809, 30.0675396 |
| La Croix du Sud Hospital | +250785246882 | -1.9582816, 30.1061156 |
| Baho International Hospital | +250782343710 | -1.9491973, 30.1054281 |
| Nyarugenge District Hospital | +250790666663 | -1.981521, 30.0433428 |
| Kibagabaga Level Two Teaching Hospital | +250798694806 | -1.9307663, 30.1119129 |
| Masaka Hospital | +250728878194 | -1.9919478, 30.2119896 |

All entries have `is_verified=true` so they appear in nearby search. Metadata (`type`, `sector`, `district`, `city`) is stored in the `services` array alongside `vaccination`.

### Verify nearby search

Start the backend (`npm run dev`), then:

```bash
curl -s "http://localhost:3000/api/v1/user/hospitals/nearby?lat=-1.9441&lng=30.0619&verifiedOnly=true" | jq '.hospitals[] | {name, distance_km, is_verified}'
```

Expect the 8 seeded hospitals (plus any other verified facilities in range) sorted by distance from central Kigali.

---

## Option B: curl via API (dev JWT workaround)

### Getting a token

Log in (`POST /auth/login` with phone + password), or mint one for an existing user without a password:

```bash
npx tsx scripts/generate-dev-jwt.ts +250780000001
```

Never expose `JWT_SECRET` to clients.

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
| `scripts/seed-kigali-hospitals.ts` | 8 real Kigali hospitals + vaccines |
| `scripts/seed-via-curl.sh` | API seed via curl + dev JWT |

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `401 Authorization token required` | Missing Bearer header | Set `Authorization: Bearer $TOKEN` |
| `401 Invalid token` | Wrong JWT secret | Token signed with a different `JWT_SECRET` (log in again after changing it) |
| `403 hospital role required` | Signup not done yet | Call `POST /hospital/signup` first |
| `409 Hospital account already registered` | Phone already owns a hospital | Use a new phone or seed vaccines only |
| `409 Vaccine with this name and dose already exists` | Duplicate catalog entry | Safe to ignore (idempotent) |
