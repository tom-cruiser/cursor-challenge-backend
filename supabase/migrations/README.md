# Supabase Migrations

Apply migrations **in order** via Supabase SQL Editor or `supabase db push`.

| # | File | Status | Description |
|---|------|--------|-------------|
| 001 | `20260705100000_initial_schema.sql` | **Active** | Core schema: users, hospitals, vaccines, children, schedules, FCM tokens |
| 002 | `20260705110000_002_platform_admin_and_verification.sql` | Future | Platform `admin` role, hospital verification requests |
| 003 | `20260705120000_003_notification_preferences_and_audit.sql` | Future | Per-parent reminder prefs, notification delivery log |
| 004 | `20260705130000_004_vaccination_cards_and_health_notes.sql` | Future | Vaccination card upload metadata, child health notes |

## Apply now (hackathon MVP)

```sql
-- Run only migration 001 in Supabase SQL Editor
```

## Apply later

Run 002 → 003 → 004 sequentially when the corresponding backend features are implemented.

## Naming convention

```
{timestamp}_{00N}_{short_description}.sql
```

- `00N` = migration sequence number (001, 002, 003, …)
- Timestamp ensures correct ordering in Supabase CLI
