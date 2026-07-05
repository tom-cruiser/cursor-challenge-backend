# Hospital Admin Setup

The **admin portal** in the frontend maps to the backend `hospital` role. There is no separate platform super-admin — each hospital operator manages their own facility.

---

## Seeded admin accounts

Run the seed script (idempotent — safe to re-run):

```bash
cd cursor-challenge-backend
npm run seed:admin
```

Requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`.

### Primary admin (mock auth + JWT)

| Field | Value |
|-------|-------|
| **Hospital** | Kigali University Teaching Hospital |
| **Mock email** | `admin@demo.com` |
| **Mock password** | `password123` |
| **Phone (JWT / API auth)** | `+250780000001` |
| **DB email** | `admin@demo.com` |
| **Operator name** | Dr. Marcus Webb |

### Secondary admin (JWT / curl testing)

| Field | Value |
|-------|-------|
| **Hospital** | King Faisal Hospital |
| **Phone (JWT / API auth)** | `+250780000002` |
| **DB email** | `admin2@demo.com` |

No mock email/password is pre-configured for the second account. Use phone OTP (live mode) or mint a dev JWT (see below).

---

## Login — mock mode (recommended for local dev)

1. Start backend and frontend (see root `CONNECTION.md`).
2. Ensure frontend `.env` has:
   - `VITE_USE_MOCK_AUTH=true`
   - `VITE_DEV_JWT_SECRET` = backend `SUPABASE_JWT_SECRET`
3. Open http://localhost:5173/auth/admin/login
4. Sign in with **`admin@demo.com`** / **`password123`**
5. The app mints a dev JWT for phone `+250780000001`, syncs with `GET /hospital/profile`, and redirects to `/admin/dashboard`.

Admin routes:

- `/admin/dashboard` — stats overview
- `/admin/families` — registered families & children
- `/admin/hospitals` — hospital directory (your facility + others)
- `/admin/schedules` — vaccine catalog

---

## Login — live mode (Supabase phone OTP)

1. Set `VITE_USE_MOCK_AUTH=false` and configure `VITE_SUPABASE_ANON_KEY`.
2. Enable **Phone** auth in Supabase → Authentication → Providers.
3. Go to http://localhost:5173/auth/admin/login
4. Enter phone **`+250780000001`** (or `+250780000002` for the second hospital).
5. Complete OTP verification.

The backend resolves the JWT phone to the `users` row and requires `role = hospital` plus a linked `hospitals` row.

---

## Login — curl / API testing (dev JWT)

Mint a token (uses `SUPABASE_JWT_SECRET` from backend `.env`):

```bash
cd cursor-challenge-backend
npm run dev:jwt -- +250780000001
```

Use the token:

```bash
TOKEN=$(npm run dev:jwt -- +250780000001 2>/dev/null | tail -1)

curl -s http://localhost:3000/api/v1/hospital/profile \
  -H "Authorization: Bearer $TOKEN" | jq

curl -s http://localhost:3000/api/v1/hospital/stats \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `No hospital is registered for this account` | Run `npm run seed:admin` |
| `403 hospital role required` | User exists as `parent` — re-run seed (promotes to `hospital`) |
| Mock login works but API calls fail | Backend not running, or `VITE_DEV_JWT_SECRET` ≠ `SUPABASE_JWT_SECRET` |
| `Invalid token` | Regenerate JWT; default expiry is 24 hours |

---

## Related

- Migration seed: `supabase/migrations/20260705100000_initial_schema.sql` (same phones)
- Frontend demo accounts: `cursor-challenge-frontend/src/data/authStore.ts`
- General hospitals/vaccines seed: `npm run seed` (`scripts/seed-data.ts`)
- Real Kigali hospital directory: `npm run seed:hospitals` (`scripts/seed-kigali-hospitals.ts`)
