# Employee Access Plan (Temporary to Secure)

## Goal

Prevent employees from seeing financial metrics (`revenue`, `profit`, `roi`, `payout`) with a practical rollout path:

1. Keep current UI masking for temporary control.
2. Add login and role-based access.
3. Enforce filtering at backend response level (real protection).

---

## Scope of Restricted Data

For role `employee`, hide and/or remove:

- `revenue`
- `profit`, `netProfit`, `grossProfit`
- `roi`
- `payout`
- Any exports (CSV/PDF) containing the above

---

## API Spec (MVP)

### `POST /auth/login`

Request:

```json
{
  "email": "admin@company.com",
  "password": "your_password"
}
```

Response `200`:

```json
{
  "user": {
    "id": "u_123",
    "email": "admin@company.com",
    "role": "admin"
  }
}
```

Errors:

- `401` invalid credentials
- `403` user inactive
- `429` too many attempts

Notes:

- Prefer httpOnly cookie session (`Secure`, `SameSite=Lax`).

### `POST /auth/logout`

Response `200`:

```json
{ "ok": true }
```

### `GET /auth/me`

Response `200`:

```json
{
  "user": {
    "id": "u_123",
    "email": "staff@company.com",
    "role": "employee"
  }
}
```

Error: `401` when session missing/expired.

### `GET /users` (admin only)

Response `200`:

```json
{
  "items": [
    {
      "id": "u_123",
      "email": "admin@company.com",
      "role": "admin",
      "isActive": true,
      "createdAt": "2026-03-10T00:00:00.000Z"
    }
  ]
}
```

### `POST /users` (admin only)

Request:

```json
{
  "email": "staff@company.com",
  "password": "TempPass123!",
  "role": "employee"
}
```

Response `201`:

```json
{ "id": "u_456", "email": "staff@company.com", "role": "employee" }
```

### `PATCH /users/:id/role` (admin only)

Request:

```json
{ "role": "admin" }
```

### `PATCH /users/:id/status` (admin only)

Request:

```json
{ "isActive": false }
```

---

## Authorization Rules

- `requireAuth()` on all protected endpoints
- `requireRole("admin")` on admin-only endpoints
- Employee cannot access admin settings/finance exports

Role matrix:

- `admin`: full access
- `employee`: no financial metrics, no financial exports

---

## Backend Sanitizer (Critical)

Apply server-side filtering before returning response to `employee`.

```js
const SENSITIVE_KEYS = new Set([
  "revenue",
  "profit",
  "netProfit",
  "grossProfit",
  "roi",
  "payout",
]);

function sanitizeForEmployee(input) {
  if (Array.isArray(input)) return input.map(sanitizeForEmployee);
  if (!input || typeof input !== "object") return input;

  const out = {};
  for (const [k, v] of Object.entries(input)) {
    if (SENSITIVE_KEYS.has(k)) continue;
    out[k] = sanitizeForEmployee(v);
  }
  return out;
}
```

Usage:

```js
const report = await getReportData();
return user.role === "employee" ? sanitizeForEmployee(report) : report;
```

---

## Database Schema (MVP)

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','employee')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip TEXT,
  ua TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## Tonight Execution Checklist

- [ ] Create `users` and `sessions` tables
- [ ] Seed first admin account
- [ ] Implement `POST /auth/login`
- [ ] Implement `POST /auth/logout`
- [ ] Implement `GET /auth/me`
- [ ] Add `requireAuth()` middleware
- [ ] Add `requireRole("admin")` middleware
- [ ] Add response sanitizer for employee role
- [ ] Protect all report/export endpoints
- [ ] Add frontend login page
- [ ] Add frontend route guard by role
- [ ] Keep current `hideRevenue` toggle as emergency fallback
- [ ] Test with 2 accounts (`admin`, `employee`)

---

## Test Cases

- [ ] Employee response payload does not include restricted fields
- [ ] Employee cannot access admin-only endpoints (`403`)
- [ ] Employee exports contain no restricted financial fields
- [ ] Admin still sees full metrics
- [ ] Inactive user cannot login
- [ ] Expired session returns `401` on `/auth/me`

---

## Rollout Plan

1. Deploy auth + middleware + sanitizer first.
2. Enable mandatory login.
3. Keep UI hide toggle only as temporary fallback.
4. Remove reliance on UI-only masking when backend role filtering is stable.
