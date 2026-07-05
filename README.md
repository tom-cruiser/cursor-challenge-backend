# Vaccination Reminder Backend

Backend for the **Vaccination Reminder Web App** (Cursor Kigali Hackathon 2026). Connects parents with hospitals for child vaccination scheduling, reminders, and tracking.

## Features

### Parent side
- Sign up with phone (Supabase Auth), profile: name, optional email, country
- Add children with birth dates and notes
- Find nearby hospitals (Haversine distance)
- Register to a hospital and select it for each child
- View vaccination timeline and upcoming doses based on hospital vaccines + child age
- Mark doses complete with optional card photo URL
- Web push notifications (FCM)

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

Apply the database migration in Supabase SQL Editor:
`supabase/migrations/20260705100000_initial_schema.sql`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with hot reload (`tsx watch`) |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm start` | Run compiled production build |
| `npm run check` | Build + business logic + wiring checks |
| `npm run check:logic` | Pure logic tests (no DB/env) |
| `npm run check:wiring` | App boot + module export verification |

## API

Base URL: `http://localhost:3000/api/v1`

- Health: `GET /health`
- Parent routes: `/user/...`
- Hospital routes: `/hospital/...`

Full reference: [docs/API.md](docs/API.md)

## Documentation

| Doc | Contents |
|-----|----------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, data model, flows |
| [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) | `.env` setup for Supabase, FCM, Resend, Africa's Talking |
| [docs/API.md](docs/API.md) | REST endpoint reference |
| [AGENTS.md](AGENTS.md) | AI agent context and conventions |

## Environment variables

Required: Supabase, Firebase (FCM), Resend.

Planned: Africa's Talking SMS (stub ready, set `AFRICASTALKING_ENABLED=true` when wired).

See [.env.example](.env.example) and [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md).

## Tech stack

Node.js · Express · TypeScript · Supabase (PostgreSQL) · Firebase Admin (FCM) · Resend · node-cron

## License

MIT
