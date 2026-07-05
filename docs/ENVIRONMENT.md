# Environment & Platform Setup

Copy `.env.example` to `.env` and configure each section below.

```bash
cp .env.example .env
```

---

## Variable reference

### Server

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | HTTP listen port |
| `NODE_ENV` | No | `development` | `development` \| `production` \| `test` |
| `CRON_TZ` | No | `Africa/Kigali` | Timezone for daily reminder cron |
| `FRONTEND_URL` | No | `http://localhost:5173` | Vite app origin — CORS allowed origin and WebSocket `Origin` check |

### Supabase

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | **Yes** | Project URL (`https://xxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Service role key — **server only, never expose to client** |
| `SUPABASE_JWT_SECRET` | **Yes** | JWT secret for verifying phone-auth tokens |

### Firebase (FCM Web Push)

| Variable | Required | Description |
|----------|----------|-------------|
| `FIREBASE_PROJECT_ID` | **Yes** | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | **Yes** | Service account email |
| `FIREBASE_PRIVATE_KEY` | **Yes** | Service account private key (use `\n` for newlines in `.env`) |

### Resend (Email)

| Variable | Required | Description |
|----------|----------|-------------|
| `RESEND_API_KEY` | **Yes** | API key from Resend dashboard |
| `RESEND_FROM_EMAIL` | **Yes** | Verified sender address (e.g. `reminders@yourdomain.com`) |

### Africa's Talking (SMS — planned)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AFRICASTALKING_API_KEY` | When SMS enabled | — | API key from Africa's Talking dashboard |
| `AFRICASTALKING_USERNAME` | No | `sandbox` | App username (`sandbox` for testing) |
| `AFRICASTALKING_SENDER_ID` | When SMS enabled | — | Shortcode or alphanumeric sender ID |
| `AFRICASTALKING_ENABLED` | No | `false` | Set `true` once SMS is wired in notification service |
| `NOTIFICATION_SMS_FALLBACK` | No | `true` | Feature flag for SMS fallback in cascade |

---

## Platform setup guides

### 1. Supabase

**Used for:** PostgreSQL database, phone-number authentication (JWT).

1. Create a project at [supabase.com](https://supabase.com)
2. **Database:** SQL Editor → paste and run:
   ```
   supabase/migrations/20260705100000_initial_schema.sql
   ```
3. **Phone Auth:** Authentication → Providers → enable Phone
4. **API keys:** Project Settings → API
   - `SUPABASE_URL` = Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = `service_role` key (secret)
5. **JWT Secret:** Project Settings → API → JWT Settings → `JWT Secret`
   - `SUPABASE_JWT_SECRET` = this value

> The backend uses the service role key to bypass RLS. All authorization is enforced in Express middleware and services.

---

### 2. Firebase Cloud Messaging (FCM)

**Used for:** Web push notifications to parents.

1. Create a project at [Firebase Console](https://console.firebase.google.com)
2. Project Settings → **Service accounts** → **Generate new private key**
3. From the downloaded JSON:
   ```env
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
   ```
4. **Web push (frontend):** add a Firebase web app, enable Cloud Messaging, get VAPID key
5. Parents register tokens via `POST /api/v1/user/fcm-token`

**Private key formatting in `.env`:**
- Wrap in double quotes
- Replace real newlines with `\n` (the app handles conversion in `env.ts`)

---

### 3. Resend

**Used for:** Email fallback when FCM push fails and parent has `email` on profile.

1. Sign up at [resend.com](https://resend.com)
2. **Domain:** add and verify your sending domain (or use onboarding domain for testing)
3. **API key:** API Keys → Create → `RESEND_API_KEY`
4. **Sender:** use a verified address:
   ```env
   RESEND_FROM_EMAIL=reminders@yourdomain.com
   ```

**When it fires:** `notification.service.ts` attempts Resend after FCM failure if `users.email` is set.

---

### 4. Africa's Talking (SMS)

**Used for:** SMS fallback to parent's phone number when push and email both fail.

> Config at `src/config/africastalking.ts`. Enable with `AFRICASTALKING_ENABLED=true` in `.env`.

1. Create account at [africastalking.com](https://africastalking.com)
2. **Sandbox (dev):**
   - Username: `sandbox`
   - API key from dashboard → Sandbox → Settings
   - Add test phone numbers in sandbox
3. **Production:**
   - Create live app, get production API key
   - Register a **shortcode** or **alphanumeric sender ID** (country-dependent)
   - Top up SMS credits
4. Configure:
   ```env
   AFRICASTALKING_API_KEY=your_api_key
   AFRICASTALKING_USERNAME=sandbox          # or live app username
   AFRICASTALKING_SENDER_ID=VACCINE         # or your shortcode e.g. 20880
   AFRICASTALKING_ENABLED=true
   NOTIFICATION_SMS_FALLBACK=true
   ```

**Planned cascade position:**
```
FCM push failed
  → Resend email failed or no email
    → sendSms({ to: user.phone, message: body })
```

**Rwanda note:** Confirm sender ID requirements with Africa's Talking for Rwanda (+250). Alphanumeric sender IDs typically need operator approval.

---

## Example `.env` (development)

```env
PORT=3000
NODE_ENV=development
CRON_TZ=Africa/Kigali

SUPABASE_URL=https://abcdefgh.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
SUPABASE_JWT_SECRET=your-jwt-secret-from-supabase

FIREBASE_PROJECT_ID=vaccination-reminder
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=onboarding@resend.dev

AFRICASTALKING_API_KEY=atsk_...
AFRICASTALKING_USERNAME=sandbox
AFRICASTALKING_SENDER_ID=VACCINE
AFRICASTALKING_ENABLED=false
NOTIFICATION_SMS_FALLBACK=true
```

---

## Validation

On startup, `src/config/env.ts` validates all required variables with Zod. Missing or invalid values print field errors and exit.

```bash
npm run dev
# Invalid environment variables: { SUPABASE_URL: ['Required'] }
```

---

## Security checklist

- [ ] Never commit `.env` (listed in `.gitignore`)
- [ ] Never expose `SUPABASE_SERVICE_ROLE_KEY` to frontend
- [ ] Use separate Firebase/Resend/Africa's Talking keys per environment
- [ ] Rotate keys if leaked
- [ ] In production, set `NODE_ENV=production`

---

## Next step: enable Africa's Talking

Set in `.env`:

```env
AFRICASTALKING_ENABLED=true
```

The notification cascade in `notification.service.ts` is already wired: FCM → Resend → SMS.
