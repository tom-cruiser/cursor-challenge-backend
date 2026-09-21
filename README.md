# Vaccination Reminder Backend

Backend for the **Vaccination Reminder Web App** (Cursor Kigali Hackathon 2026). Connects parents with hospitals for child vaccination scheduling, reminders, and tracking.

## Features

### Parent side
- Sign up with phone + password, profile: name, optional email, country
- Add children with birth dates and notes
- Find nearby hospitals (Haversine distance)
- Register to a hospital and select it for each child
- View vaccination timeline and upcoming doses based on hospital vaccines + child age
- Mark doses complete with optional card photo URL
- Web push notifications (FCM), with email and SMS fallback
- AI vaccination assistant grounded in the parent's own children and schedules, with emergency-safety guardrails

### Hospital side
- Sign up as a hospital operator with location, help phone, operating hours
- Create and manage vaccines (age range, purpose, details, cron reminder days)
- View registered parents and their children
- Manually add parents/children
- Mark vaccinations complete
- View overdue children and dashboard stats

## Quick start

```bash
npm install
cp .env.example .env   # fill in values — see docs/ENVIRONMENT.md
npm run dev            # http://localhost:3000
```

Set `DATABASE_URL` in `.env` (local PostgreSQL, e.g. `postgresql://postgres:PASSWORD@127.0.0.1:5432/vaccination`), then create the database and apply the migrations:

```bash
npm run migrate   # creates the DB if missing, applies supabase/migrations/*.sql (skips the Supabase-only RLS file)
npm run seed:hospitals
```

Authentication is built in (phone + password, JWT signed with `JWT_SECRET`) — no external auth service. Seeded hospital demo logins: `npm run seed:admin` (see docs/ADMIN_SETUP.md); set any user's password with `npm run set-password -- +250... 'password'`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run migrate` | Create local DB + apply migrations |
| `npm run dev` | Dev server with hot reload (`tsx watch`) |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm start` | Run compiled production build |
| `npm run check` | Build + business logic + wiring checks |
| `npm run check:logic` | Pure logic tests (no DB/env) |
| `npm run check:wiring` | App boot + module export verification |

## API

Base URL: `http://localhost:3000/api/v1`

- Health: `GET /health`
- Auth: `/auth/register`, `/auth/login`
- Parent routes: `/user/...`
- Hospital routes: `/hospital/...`
- AI assistant (SSE streaming): `/ai/...`
- Realtime hospital events: `ws://<host>/ws/hospitals`

Full reference: [docs/API.md](docs/API.md)

## Documentation

| Doc | Contents |
|-----|----------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, data model, flows |
| [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) | `.env` setup for Postgres, JWT, FCM, Resend, Africa's Talking |
| [docs/API.md](docs/API.md) | REST endpoint reference |
| [AGENTS.md](AGENTS.md) | AI agent context and conventions |

## Environment variables

Required: PostgreSQL (`DATABASE_URL`), `JWT_SECRET`, Firebase (FCM), Resend.

Optional: Africa's Talking SMS fallback (`AFRICASTALKING_ENABLED=true`), OpenRouter for the AI assistant (`OPENROUTER_API_KEY`), `TRUST_PROXY` when deployed behind a proxy.

See [.env.example](.env.example) and [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md).

## Tech stack

Node.js · Express · TypeScript · PostgreSQL (`pg`) · JWT auth · Firebase Admin (FCM) · Resend · node-cron

## License

MIT
