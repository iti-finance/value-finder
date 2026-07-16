# API And Server Functions

Value Finder does not expose a hand-written REST API. Client pages call
TanStack Server Functions exported from `src/lib/*.functions.ts`.

This document describes those server functions as the application's API
surface.

## Common Behavior

Server functions are configured through TanStack Start in `src/start.ts`.

- CSRF middleware is applied to server function requests.
- The client-side `attachAuthToken` middleware attaches the JWT bearer token
  from browser `localStorage`.
- Authenticated functions use `requireAuth`.
- Input validation is handled with Zod.
- Database access goes through `src/integrations/db/client.server.ts`.

Authenticated function calls must include:

```text
Authorization: Bearer <jwt>
```

The JWT payload provides this server-side context:

```ts
{
  userId: string;
  role: "admin" | "branch";
  employeeCode: string;
  fullName: string;
}
```

Admin-only functions perform an additional database role check against
`user_roles`.

## Auth Functions

File:

```text
src/lib/auth.functions.ts
```

### `login`

Method: `POST`

Auth: public

Input:

```ts
{
  identifier: string;
  password: string;
  mode: "branch" | "admin";
}
```

Behavior:

- Branch mode looks up the user by `employee_code`.
- Admin mode looks up the user by `email`.
- Inactive users are rejected.
- Passwords are verified against `profiles.password_hash`.
- Returns a signed JWT and basic user details.

Returns:

```ts
{
  token: string;
  user: {
    userId: string;
    role: "admin" | "branch";
    employeeCode: string;
    fullName: string;
  };
}
```

### `bootstrapFirstAdmin`

Method: `POST`

Auth: public

Input:

```ts
{
  employee_code: string;
  full_name: string;
  email: string;
  password: string;
}
```

Behavior:

- Creates the first admin account only when no admin role exists.
- Password must be at least 6 characters.
- Inserts into `profiles` and `user_roles`.

Returns:

```ts
{ ok: true }
```

### `requestPasswordReset`

Method: `POST`

Auth: public

Input:

```ts
{
  employee_code: string;
}
```

Behavior:

- Creates a `password_reset_requests` row only when the employee code belongs
  to an active profile.
- Always returns success to avoid revealing whether an employee code exists.

Returns:

```ts
{ ok: true }
```

### `adminBootstrapStatus`

Method: `GET`

Auth: public

Behavior:

- Checks whether any admin role exists.

Returns:

```ts
{
  needsBootstrap: boolean;
}
```

## Vehicle Functions

File:

```text
src/lib/vehicle.functions.ts
```

All functions in this file require authentication.

### `getVehicleMakes`

Method: `GET`

Returns distinct vehicle makes sorted ascending.

```ts
{
  makes: string[];
}
```

### `getVehicleYears`

Method: `GET`

Returns distinct vehicle years sorted descending.

```ts
{
  years: number[];
}
```

### `getVehicleModels`

Method: `POST`

Input:

```ts
{
  make: string;
}
```

Returns distinct models for the selected make.

```ts
{
  models: string[];
}
```

### `getVehicleVariants`

Method: `POST`

Input:

```ts
{
  make: string;
  model: string;
}
```

Returns distinct variants for the selected make and model.

```ts
{
  variants: string[];
}
```

### `searchVehicle`

Method: `POST`

Input:

```ts
{
  make: string;
  model: string;
  variant: string;
  year: number;
}
```

Behavior:

- Fetches a single matching row from `vehicle_values`.
- Returns `null` when no match exists.
- Valuation adjustments are currently applied in the page component after the
  base row is returned.

Returns:

```ts
{
  row: null | {
    make: string;
    model: string;
    variant: string;
    year: number;
    value: string;
  };
}
```

### `logAuditEvent`

Method: `POST`

Input:

```ts
{
  action: string;
  details?: unknown;
}
```

Behavior:

- Inserts an audit row for the authenticated user.
- Stores `user_id`, `employee_code`, `action`, and optional JSON details.

Returns:

```ts
{ ok: true }
```

### `getUploadHistory`

Method: `GET`

Returns the 10 most recent upload history records.

```ts
{
  history: Array<{
    filename: string;
    record_count: number;
    uploaded_at: string;
  }>;
}
```

### `getPasswordResetRequests`

Method: `GET`

Returns the 50 most recent password reset requests.

```ts
{
  requests: Array<{
    id: string;
    employee_code: string;
    requested_at: string;
    status: string;
  }>;
}
```

Note: this function is authenticated but does not perform its own admin role
check. It is currently used from the admin page.

### `getAuditLogs`

Method: `POST`

Input:

```ts
{
  action?: string;
}
```

Behavior:

- Returns the 200 most recent audit logs.
- When `action` is provided and is not `all`, only that action is returned.

Returns:

```ts
{
  logs: Array<{
    id: string;
    user_id: string | null;
    employee_code: string | null;
    action: string;
    user_agent: string | null;
    ip: string | null;
    details: unknown;
    created_at: string;
  }>;
}
```

Note: this function is authenticated but does not perform its own admin role
check. It is currently used from the admin page.

## Admin Functions

File:

```text
src/lib/admin.functions.ts
```

All functions require authentication. Mutating admin functions verify that the
current user has the `admin` role.

### `checkIsAdmin`

Method: `GET`

Returns whether the authenticated user has the `admin` role.

```ts
{
  isAdmin: boolean;
}
```

### `replaceVehicleData`

Method: `POST`

Auth: admin

Input:

```ts
{
  filename: string;
  rows: Array<{
    make: string;
    model: string;
    variant: string;
    year: number;
    value: number;
  }>;
}
```

Behavior:

- Deletes all existing rows from `vehicle_values`.
- Inserts the supplied rows in batches of 1000.
- Writes an `upload_history` record.

Returns:

```ts
{
  ok: true;
  count: number;
}
```

### `promoteSelfToAdminIfEmpty`

Method: `POST`

Auth: authenticated

Behavior:

- Promotes the current user to admin only when no admin role exists.
- Returns `promoted: false` if an admin already exists.

Returns:

```ts
{
  promoted: boolean;
}
```

### `deleteAuditLog`

Method: `POST`

Auth: admin

Input:

```ts
{
  id: string;
}
```

Returns:

```ts
{ ok: true }
```

### `clearAuditLogs`

Method: `POST`

Auth: admin

Input:

```ts
{
  action?: string;
}
```

Behavior:

- Deletes all audit logs when `action` is absent or `all`.
- Deletes only matching actions otherwise.

Returns:

```ts
{
  ok: true;
  deleted: number;
}
```

### `changeOwnPassword`

Method: `POST`

Auth: admin

Input:

```ts
{
  password: string;
}
```

Behavior:

- Updates the current admin user's password hash.
- Password length must be 4 to 128 characters.

Returns:

```ts
{ ok: true }
```

## User Functions

File:

```text
src/lib/users.functions.ts
```

Most functions require authentication and admin authorization.

### `createUser`

Method: `POST`

Auth: admin

Input:

```ts
{
  employee_code: string;
  full_name: string;
  email?: string;
  role: "admin" | "branch";
  password?: string;
}
```

Behavior:

- Creates a profile and role.
- Admin users must have an email address.
- If no password is provided, the employee code is used as the initial
  password.

Returns:

```ts
{
  ok: true;
  user_id: string;
}
```

### `listAllUsers`

Method: `GET`

Auth: admin

Returns all users, newest first.

```ts
Array<{
  user_id: string;
  employee_code: string;
  full_name: string;
  email: string | null;
  is_active: boolean;
  role: string;
  created_at: string;
}>
```

### `setUserActive`

Method: `POST`

Auth: admin

Input:

```ts
{
  user_id: string;
  is_active: boolean;
}
```

Returns:

```ts
{ ok: true }
```

### `deleteUser`

Method: `POST`

Auth: admin

Input:

```ts
{
  user_id: string;
}
```

Behavior:

- Deletes the user's role and profile.
- The current admin cannot delete their own account.

Returns:

```ts
{ ok: true }
```

### `resetUserPassword`

Method: `POST`

Auth: admin

Input:

```ts
{
  user_id: string;
  password?: string;
}
```

Behavior:

- Sets a supplied password when provided.
- Otherwise resets the password to the user's employee code.

Returns:

```ts
{
  ok: true;
  password: string;
}
```

### `bulkCreateUsers`

Method: `POST`

Auth: admin

Input:

```ts
{
  rows: Array<{
    employee_code: string;
    full_name: string;
    email?: string;
    role?: string;
    password?: string;
  }>;
}
```

Behavior:

- Accepts 1 to 1000 user rows.
- Treats `role: "admin"` as admin; all other role values default to branch.
- Admin rows require an email address.
- Empty passwords default to the employee code.
- Continues processing after row-level failures.

Returns:

```ts
{
  created: number;
  failed: number;
  results: Array<{
    employee_code: string;
    status: "created" | "failed";
    message?: string;
  }>;
}
```

### `resolvePasswordResetRequest`

Method: `POST`

Auth: admin

Input:

```ts
{
  id: string;
  status: "resolved" | "rejected";
}
```

Behavior:

- Updates reset request status.
- Sets `resolved_at` and `resolved_by`.

Returns:

```ts
{ ok: true }
```

## Public Helper Functions In `users.functions.ts`

`users.functions.ts` also exports public first-admin and password-reset helper
functions similar to `auth.functions.ts`. The current auth page imports these
flows from `auth.functions.ts`; keep duplicate behavior in sync if either file
is changed.

## Error Handling

Server function errors are thrown as JavaScript errors. The UI currently shows
most failures through toast messages.

Common failure categories:

- validation errors from Zod
- missing or invalid JWT
- inactive user account
- missing admin role
- unique constraint conflicts in PostgreSQL
- missing database rows

## Related Documentation

- `docs/architecture.md` - system flow and layer overview
- `docs/database.md` - table structure and relationships
- `docs/permissions.md` - role and access rules
