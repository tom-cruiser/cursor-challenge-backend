# API Reference

Base URL: `/api/v1`

All protected routes require:
```
Authorization: Bearer <supabase_jwt>
```

---

## Public

### Health check
```
GET /health
```
```json
{ "status": "ok", "timestamp": "2026-07-05T09:00:00.000Z" }
```

---

## Parent routes (`/user`)

> Requires `role: parent`

### Profile

#### Get profile
```
GET /user/profile
```

#### Complete / update profile (signup)
```
PATCH /user/profile
```
```json
{
  "name": "Marie Uwase",
  "email": "marie@example.com",
  "country": "Rwanda"
}
```

### Children

#### List children
```
GET /user/children
```

#### Create child
```
POST /user/children
```
```json
{
  "name": "Jean Uwase",
  "dateOfBirth": "2024-06-15",
  "sex": "male",
  "notes": "Optional notes",
  "preferredHospitalId": "uuid-of-hospital"
}
```
Response includes auto-generated `schedule` if hospital was provided.

#### Set preferred hospital (regenerates schedule)
```
PATCH /user/children/:id/preferred-hospital
```
```json
{ "hospitalId": "uuid" }
```

### Timeline & vaccines

#### Full timeline (sorted)
```
GET /user/children/:id/timeline
```

#### Upcoming vaccines (hospital + age filtered)
```
GET /user/children/:id/upcoming-vaccines
```

#### Mark dose complete
```
PATCH /user/timeline/:itemId
```
```json
{ "cardPhotoUrl": "https://storage.example.com/card.jpg" }
```

### Hospitals

#### Find nearby
```
GET /user/hospitals/nearby?lat=-1.9441&lng=30.0619&limit=20&verifiedOnly=true
```

#### Register to hospital
```
POST /user/hospitals/:id/register
```

### Notifications

#### Register FCM token
```
POST /user/fcm-token
```
```json
{ "token": "fcm-web-push-token" }
```

---

## Hospital routes (`/hospital`)

### Signup (before hospital role is assigned)

> Requires auth but **not** `requireRole('hospital')` — callable by newly authenticated users.

```
POST /hospital/signup
```
```json
{
  "name": "Kigali Health Center",
  "address": "KN 4 Ave",
  "latitude": -1.9441,
  "longitude": 30.0619,
  "helpPhone": "+250788123456",
  "country": "Rwanda",
  "services": ["vaccination", "pediatrics"],
  "operatingHours": {
    "monday": { "open": "08:00", "close": "17:00", "vaccination": true }
  }
}
```

---

> Routes below require `role: hospital`

### Profile

```
GET  /hospital/profile
PATCH /hospital/profile
```
Same body fields as signup (all optional on PATCH).

### Vaccines

```
POST   /hospital/vaccines
GET    /hospital/vaccines
PUT    /hospital/vaccines/:id
DELETE /hospital/vaccines/:id
```

Create body:
```json
{
  "name": "BCG",
  "itemType": "vaccine",
  "ageMinMonths": 0,
  "ageMaxMonths": 1,
  "milestoneAgeMonths": 0,
  "doseNumber": 1,
  "purpose": "Tuberculosis protection",
  "details": "Given at birth",
  "reminderDays": [3, 1]
}
```

DELETE soft-deactivates (`is_active = false`).

### Parents & children

```
GET  /hospital/parents          # registered parents + their children at this hospital
POST /hospital/parents          # manually add parent
GET  /hospital/children         # all children at hospital with age_months
POST /hospital/children         # manually add child for a parent
```

Manual parent:
```json
{
  "phone": "+250788000000",
  "name": "Parent Name",
  "email": "optional@email.com",
  "country": "Rwanda"
}
```

Manual child:
```json
{
  "parentId": "uuid",
  "name": "Child Name",
  "dateOfBirth": "2024-01-15",
  "sex": "female"
}
```

### Schedules & overdue

```
PATCH /hospital/schedules/:id/complete
GET   /hospital/overdue
GET   /hospital/stats
```

Mark complete body (optional):
```json
{ "cardPhotoUrl": "https://..." }
```

Stats response:
```json
{
  "stats": {
    "total_registered_parents": 12,
    "total_children": 18,
    "schedules_completed": 45,
    "schedules_overdue": 3,
    "schedules_due_soon": 5,
    "schedules_pending": 20,
    "completion_rate": 0.88,
    "delinquency_rate": 0.11,
    "active_vaccines": 9
  }
}
```

---

## Error responses

```json
{ "error": "Human-readable message" }
```

With validation details:
```json
{
  "error": "Validation failed",
  "details": ["name: Required"]
}
```

| Status | Meaning |
|--------|---------|
| 400 | Validation error |
| 401 | Missing/invalid JWT |
| 403 | Wrong role or ownership |
| 404 | Resource not found |
| 409 | Conflict (duplicate) |
| 500 | Server error |

---

## Status values (`child_schedules.status`)

| Status | Meaning |
|--------|---------|
| `pending` | Upcoming, not yet in reminder window |
| `due_soon` | Due within 7 days |
| `completed` | Marked done by parent or hospital |
| `overdue` | Past due date, not completed |
