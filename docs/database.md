# Database

Value Finder uses PostgreSQL as its primary database. The schema is currently
defined in:

```text
db-init.sql
```

The application connects through:

```text
src/integrations/db/client.server.ts
```

## Connection Configuration

Database settings are loaded from environment variables through
`src/lib/config.server.ts`.

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=value_finder
DB_USER=postgres
DB_PASSWORD=postgres
```

The PostgreSQL client uses a shared `pg.Pool` with:

- max connections: `20`
- idle timeout: `30000` ms
- connection timeout: `5000` ms

## Required Extension

The schema enables `pgcrypto`:

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

This is used for `gen_random_uuid()` defaults.

## Tables

### `profiles`

Stores user identity, login, and account status data.

```sql
CREATE TABLE profiles (
  user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code varchar(50) NOT NULL UNIQUE,
  full_name varchar(120) NOT NULL,
  email varchar(255),
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Columns:

- `user_id` - primary key
- `employee_code` - unique branch/admin employee code
- `full_name` - display name
- `email` - required for admin login, optional for branch users
- `password_hash` - hashed password
- `is_active` - controls whether the user can authenticate
- `created_at` - profile creation timestamp

Indexes:

```sql
CREATE UNIQUE INDEX idx_profiles_employee_code_lower
  ON profiles (lower(employee_code));

CREATE UNIQUE INDEX idx_profiles_email_lower
  ON profiles (lower(email))
  WHERE email IS NOT NULL;
```

Notes:

- Branch login uses `employee_code`.
- Admin login uses `email`.
- Inactive users are rejected by authentication middleware.

### `user_roles`

Stores the role assigned to each profile.

```sql
CREATE TABLE user_roles (
  user_id uuid PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'branch'))
);
```

Columns:

- `user_id` - primary key and foreign key to `profiles`
- `role` - either `admin` or `branch`

Relationships:

- One `profiles` row has one `user_roles` row.
- Deleting a profile cascades to the role row.

Notes:

- Admin-only server functions check this table.
- The application expects exactly one role per user.

### `vehicle_values`

Stores the master tractor value grid.

```sql
CREATE TABLE vehicle_values (
  id bigserial PRIMARY KEY,
  make text NOT NULL,
  model text NOT NULL,
  variant text NOT NULL,
  year integer NOT NULL,
  value numeric(12,2) NOT NULL,
  UNIQUE (make, model, variant, year)
);
```

Columns:

- `id` - primary key
- `make` - tractor make
- `model` - tractor model
- `variant` - model variant
- `year` - manufacturing year
- `value` - base financing grid value

Constraints:

- Each make/model/variant/year combination must be unique.

Notes:

- The value finder reads the base value from this table.
- Application-level valuation rules are applied after fetching the base value.
- Master data upload deletes all existing rows before inserting the replacement
  dataset.

### `upload_history`

Tracks successful master data uploads.

```sql
CREATE TABLE upload_history (
  id bigserial PRIMARY KEY,
  uploaded_by uuid REFERENCES profiles(user_id),
  filename varchar(255) NOT NULL,
  record_count integer NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
```

Columns:

- `id` - primary key
- `uploaded_by` - user who uploaded the file
- `filename` - uploaded file name
- `record_count` - number of inserted value rows
- `uploaded_at` - upload timestamp

Relationships:

- `uploaded_by` references `profiles.user_id`.

Notes:

- The admin UI shows the 10 most recent upload records.
- Because this foreign key does not cascade, deleting a profile with related
  upload history can be blocked unless the related rows are handled first.

### `audit_logs`

Stores application activity logs.

```sql
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(user_id),
  employee_code varchar(50),
  action text NOT NULL,
  user_agent text,
  ip text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Columns:

- `id` - primary key
- `user_id` - authenticated user id when available
- `employee_code` - employee code captured at the time of the event
- `action` - event type, for example `login`, `search`, `upload_master_data`
- `user_agent` - reserved for request user agent data
- `ip` - reserved for request IP data
- `details` - JSON event details
- `created_at` - event timestamp

Indexes:

```sql
CREATE INDEX idx_audit_logs_action ON audit_logs (action);
```

Notes:

- The admin UI can filter by action.
- Admins can delete individual logs or clear logs by action.
- Current logging writes `user_agent` as `null` in `logAuditEvent`.
- Because `user_id` does not cascade, deleting a profile with related audit
  logs can be blocked unless the related rows are handled first.

### `password_reset_requests`

Stores password reset requests submitted from the login page.

```sql
CREATE TABLE password_reset_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code varchar(50) NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  resolved_at timestamptz,
  resolved_by uuid REFERENCES profiles(user_id)
);
```

Columns:

- `id` - primary key
- `employee_code` - employee code requesting help
- `requested_at` - request timestamp
- `status` - current request status
- `resolved_at` - timestamp when resolved or rejected
- `resolved_by` - admin user who resolved or rejected the request

Indexes:

```sql
CREATE INDEX idx_password_reset_requests_employee_code
  ON password_reset_requests (lower(employee_code));
```

Notes:

- Public reset requests always return success to prevent employee-code
  enumeration.
- A row is inserted only when the employee code belongs to an active profile.
- Admins can mark requests as `resolved` or `rejected`.
- The schema does not currently restrict `status` values with a check
  constraint.
- Because `resolved_by` does not cascade, deleting a profile referenced by
  resolved requests can be blocked unless the related rows are handled first.

## Relationships

```text
profiles
  | 1:1
  v
user_roles

profiles
  | 1:many
  v
upload_history

profiles
  | 1:many
  v
audit_logs

profiles
  | 1:many
  v
password_reset_requests.resolved_by

vehicle_values
  standalone master data table
```

## Data Lifecycle

### User Lifecycle

1. First admin is created from `/auth` when no admin role exists.
2. Admins create branch/admin users from the admin console.
3. Passwords are stored in `profiles.password_hash`.
4. Admins can activate, deactivate, reset, or delete users.
5. Deleting a profile cascades to `user_roles`.
6. Deleting a profile may be blocked by related `upload_history`, `audit_logs`,
   or `password_reset_requests.resolved_by` rows.

### Vehicle Master Data Lifecycle

1. Admin uploads an Excel or CSV master file.
2. The frontend parses the file into make/model/variant/year/value rows.
3. `replaceVehicleData` deletes all rows from `vehicle_values`.
4. New rows are inserted in batches of 1000.
5. A row is added to `upload_history`.
6. An audit event is written separately from the admin page.

Supported upload columns:

- `Make`
- `Model`
- `Model Variant`
- one or more year columns such as `2024`, `2023`, `2022`

### Audit Lifecycle

Audit rows are written for important events such as:

- login
- search
- master data upload
- admin password change

Admins can:

- view recent logs
- filter logs by action
- delete one log entry
- clear all logs or logs for one action

### Password Reset Lifecycle

1. User submits an employee code from the login page.
2. The server inserts a reset request only for active profiles.
3. Admin reviews requests in the admin console.
4. Admin resets the password separately through user management.
5. Admin marks the request as `resolved` or `rejected`.

## Migration Notes

The project currently uses `db-init.sql` as the schema source. There is no
versioned migration framework in the repository.

Recommended practice for future schema changes:

- create a new migration file instead of editing only `db-init.sql`
- include forward migration SQL
- include rollback notes when practical
- update this document and `docs/api.md` when table contracts change
- avoid destructive data changes without an explicit backup plan

## Operational Notes

- Back up the database before running destructive schema or data changes.
- Master vehicle upload is destructive for `vehicle_values`.
- `vehicle_values.value` is stored as `numeric(12,2)`, but the UI formats
  estimates without decimal places.
- Case-insensitive uniqueness is enforced for employee codes and non-null
  emails.
- There is no explicit foreign key from `password_reset_requests.employee_code`
  to `profiles.employee_code`; this preserves request history by code.

## Related Documentation

- `docs/architecture.md` - high-level system structure
- `docs/api.md` - server function behavior
- `docs/permissions.md` - roles and access rules
- `docs/deployment.md` - environment and deployment notes
