# AGENTS.md — Vaccination Reminder Backend

> Context file for AI agents and developers continuing work on this repo.

## Project

**Vaccination Reminder Web App** — Cursor Kigali Hackathon 2026 backend.

Dual-sided platform:

| Side | Role | Auth claim | Primary flows |
|------|------|------------|---------------|
| **Parent** | `parent` | Supabase phone JWT → `users.phone` | Profile, children, hospital registration, upcoming vaccines |
| **Hospital** | `hospital` | Same JWT flow | Signup, vaccine catalog, parent/child management, mark completions, stats |

Both sides meet via `parent_hospital_registrations` and `children.preferred_hospital_id`. Child schedules are generated from **`hospital_vaccines`** (not a global catalog).

## Tech stack

- **Runtime:** Node.js, Express, TypeScript
- **Database:** PostgreSQL via Supabase (`@supabase/supabase-js`, service role)
- **Auth:** Supabase phone OTP → JWT verified with `jose` + `SUPABASE_JWT_SECRET`
- **Push:** Firebase Admin (`firebase-admin`) — FCM web push
- **Email fallback:** Resend
- **SMS fallback:** Africa's Talking — `src/config/africastalking.ts` (enable with `AFRICASTALKING_ENABLED=true`)
- **Cron:** `node-cron` daily 6:00 AM `Africa/Kigali`

## Directory map

```
src/
  config/       env.ts, database.ts, firebase.ts, resend.ts, africastalking.ts
  controllers/  parent, children, timeline, hospitals, hospital-admin
  middleware/   auth.ts, role.ts, validate.ts, errorHandler.ts
  models/       types.ts
  routes/       user.routes.ts, hospital.routes.ts, index.ts
  services/     schedule, parent, hospital, hospital-admin, notification
  tasks/        reminder.cron.ts
  utils/        dates.ts, haversine.ts, errors.ts
supabase/migrations/   SQL schema + seeds
docs/                  ARCHITECTURE.md, ENVIRONMENT.md, API.md
```

## Key conventions

1. **API prefix:** `/api/v1`
2. **Errors:** throw `AppError(statusCode, message)` from services; `errorHandler` maps to JSON
3. **Validation:** Zod schemas in route files via `validate()` middleware
4. **Auth middleware:** `authenticateToken` auto-provisions `parent` users on first JWT; hospitals created via `POST /hospital/signup`
5. **Schedules:** only generated when a child has `preferred_hospital_id`; uses hospital vaccine `milestone_age_months` filtered by `age_min_months` / `age_max_months`
6. **Cron reminders:** per-vaccine `reminder_days` array (default `[3, 1]`); overdue marked daily

## Notification cascade (current → planned)

```
FCM web push (primary)
  ↓ failure or no tokens
Resend email (if user.email set)
  ↓ failure or no email
Africa's Talking SMS (if AFRICASTALKING_ENABLED=true) ← enabled via env
```

## What is NOT done yet

- [x] Africa's Talking wired into `notification.service.ts` (enable with `AFRICASTALKING_ENABLED=true`)
- [ ] Supabase migration applied in remote project (SQL file ready locally)
- [ ] Frontend integration
- [ ] Platform super-admin layer (only `parent` + `hospital` roles)
- [ ] Image upload for vaccination cards (URLs only; no storage integration)

## Before running locally

1. Copy `.env.example` → `.env` — see `docs/ENVIRONMENT.md`
2. Apply `supabase/migrations/20260705100000_initial_schema.sql`
3. `npm install && npm run dev`

## Seed accounts (migration)

| Phone | Role | Notes |
|-------|------|-------|
| `+250780000001` | hospital | Kigali University Teaching Hospital |
| `+250780000002` | hospital | King Faisal Hospital |

Parents are auto-created on first authenticated request.

## When adding features

- Match existing patterns: service → controller → route → Zod validation
- Hospital-scoped queries must verify `owner_id` / `hospital_id`
- Parent-scoped queries must verify `parent_id` ownership chain
- New env vars: update `env.ts`, `.env.example`, and `docs/ENVIRONMENT.md`
