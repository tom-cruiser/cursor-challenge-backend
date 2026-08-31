# Supabase Migrations

Apply migrations **in order** via Supabase SQL Editor or `supabase db push`.

| # | File | Status | Description |
|---|------|--------|-------------|
| 001 | `20260705100000_initial_schema.sql` | **Active** | Core schema: users, hospitals, vaccines, children, schedules, FCM tokens |
| 002 | `20260705110000_002_platform_admin_and_verification.sql` | Future | Platform `admin` role, hospital verification requests |
| 003 | `20260705120000_003_notification_preferences_and_audit.sql` | Future | Per-parent reminder prefs, notification delivery log |
| 004 | `20260705130000_004_vaccination_cards_and_health_notes.sql` | Future | Vaccination card upload metadata, child health notes |
| 005 | `20260705140000_005_row_level_security.sql` | **Active** | Enables RLS + ownership policies on every table (defense-in-depth; the backend's service-role key still bypasses RLS — see the file header) |

## Apply now (production readiness MVP)

```sql
-- Run migrations 001 and 005 in Supabase SQL Editor (in that order)
```

Migration 005 depends only on tables created in 001, so it's safe to apply
immediately even though 002–004 are not yet implemented. Apply it in a
staging Supabase project first and exercise the full app (parent + hospital
flows) before running it against production — a missing policy shows up as
data a signed-in user can no longer see (over-restrictive), not as a crash.

## Apply later

Run 002 → 003 → 004 sequentially when the corresponding backend features are
implemented, then extend migration 005's policies to cover their new tables/
columns (e.g. the `admin` role from 002 will need its own policies).

## Naming convention

```
{timestamp}_{00N}_{short_description}.sql
```

- `00N` = migration sequence number (001, 002, 003, …)
- Timestamp ensures correct ordering in Supabase CLI
