# Architecture

This document describes the high-level structure of the Value Finder
application and how the main pieces work together.

## Purpose

Value Finder is an internal ITI Finance application used by branch and admin
users to:

- look up used tractor financing grid values
- apply valuation rules based on wheel drive type and usage
- export search results as PDF reports
- manage master vehicle data
- manage users, password reset requests, and audit logs

## Technology Overview

- Frontend: React 19, TypeScript, TanStack Router, TanStack Query
- Full-stack framework: TanStack Start
- Build tool: Vite
- Runtime: Nitro Node.js server
- Styling: Tailwind CSS and shadcn/ui-style components
- Database: PostgreSQL through `pg`
- Authentication: JWT stored in browser `localStorage`
- Validation: Zod
- Imports: XLSX
- Exports: jsPDF

## Application Layers

The codebase is organized into these main layers:

- `src/routes` - file-based routes, page components, and route guards
- `src/components` - shared UI components and application shell components
- `src/hooks` - client-side reusable React hooks
- `src/lib` - server functions, business rules, error handling, and config
- `src/integrations/auth` - JWT helpers, auth middleware, token attachment
- `src/integrations/db` - PostgreSQL connection pool and query helper
- `db-init.sql` - database schema
- `docs` - project documentation

## Runtime Flow

```text
Browser
  |
  | React pages call TanStack Server Functions
  v
TanStack Start
  |
  | request middleware: CSRF + error handling
  | function middleware: attach auth token
  v
Server Functions in src/lib
  |
  | requireAuth validates JWT and active user
  v
PostgreSQL through src/integrations/db/client.server.ts
```

## Entry Points

`src/router.tsx` creates the TanStack Router instance from the generated route
tree and provides a TanStack Query client in router context.

`src/start.ts` configures TanStack Start middleware:

- `attachAuthToken` adds the bearer token from `localStorage` to server
  function calls.
- CSRF middleware protects server functions.
- global error middleware renders a friendly HTML error page for unexpected
  server failures.

`src/server.ts` is the server entry point used by the TanStack Start/Vite
configuration. It loads the TanStack server entry and normalizes catastrophic
SSR errors into the shared error page.

`vite.config.ts` wires together Tailwind, path aliases, TanStack Start, Nitro,
and React. The development server runs on port `3002`.

## Routing

The app uses TanStack Router file-based routing.

Important routes:

- `/auth` - login, forgot password request, and first-admin setup
- `/` - redirects authenticated users to `/admin` or `/value-finder`
- `/_authenticated` - authenticated layout and client-side route guard
- `/value-finder` - branch valuation workflow
- `/admin` - administrator console

The generated file `src/routeTree.gen.ts` should not be edited manually.

## Authentication And Authorization

Authentication uses JWTs signed with `JWT_SECRET`.

The login flow:

1. The user signs in on `/auth`.
2. Branch users authenticate with employee code and password.
3. Admin users authenticate with email and password.
4. The server verifies the password hash and signs a JWT.
5. The browser stores the JWT in `localStorage`.
6. Future server function calls include the token as a bearer token.

Route protection happens in two places:

- The `/_authenticated` route checks that a token exists and is not expired.
- Server functions that require a user use `requireAuth`.

`requireAuth` verifies the JWT, checks that the profile still exists and is
active, then exposes user context to the server function.

Admin-only behavior is enforced inside admin server functions by checking
`user_roles` for the `admin` role.

## Data Access

PostgreSQL access is centralized in:

```text
src/integrations/db/client.server.ts
```

This module creates a shared `pg.Pool` using environment variables from
`src/lib/config.server.ts`. Application code uses the exported `db.query`
helper for SQL queries.

Core tables:

- `profiles` - user identity, employee code, email, password hash, active flag
- `user_roles` - `admin` or `branch` role per user
- `vehicle_values` - make/model/variant/year/value records
- `upload_history` - master data upload records
- `audit_logs` - login, search, upload, and admin activity records
- `password_reset_requests` - user-submitted password reset requests

See `docs/database.md` for database details.

## Server Functions

Server functions live mainly in `src/lib`.

Main groups:

- `auth.functions.ts` - login, first-admin bootstrap, password reset request
- `vehicle.functions.ts` - vehicle lookup data, search, audit logs, upload
  history, reset request listing
- `admin.functions.ts` - admin checks, master data replacement, audit cleanup,
  own password change
- `users.functions.ts` - user CRUD, activation, password reset, bulk user upload

Server functions use Zod validators for input validation and SQL queries for
database operations.

## Vehicle Valuation Workflow

The branch workflow is implemented in:

```text
src/routes/_authenticated/value-finder.tsx
```

The page loads selectable makes, models, variants, and years from
`vehicle_values`. After the user submits a search:

1. The app fetches the base value for make/model/variant/year.
2. `4WD` adds a 10% uplift.
3. Vehicles from 2012 or earlier are marked `Vintage`.
4. Vintage Agriculture values are capped at `150000`.
5. Vintage Commercial values are capped at `125000`.
6. The result is shown to the user and can be exported as a PDF.
7. A search audit event is written.

Recent search history is stored in browser `localStorage` by
`src/hooks/use-search-history.ts`.

## Admin Workflow

The admin console is implemented in:

```text
src/routes/_authenticated/admin.tsx
```

Admin capabilities include:

- replacing vehicle master data from `.xlsx`, `.xls`, or `.csv`
- viewing upload history
- creating users one at a time
- bulk uploading users
- activating and deactivating users
- resetting user passwords
- deleting users
- reviewing password reset requests
- reviewing, filtering, deleting, and clearing audit logs
- changing the current admin password

Vehicle master uploads replace all rows in `vehicle_values`, then insert the
new parsed rows in batches.

## Error Handling

Unexpected server errors are handled by shared error utilities:

- `src/lib/error-capture.ts`
- `src/lib/error-page.ts`
- `src/lib/error-reporting.ts`

`src/start.ts` catches application server errors during request handling.
`src/server.ts` also normalizes a specific SSR failure response shape into the
same HTML error page.

## Build And Deployment Shape

Development runs through Vite:

```bash
npm run dev
```

Production build:

```bash
npm run build
```

The build output is generated under:

```text
.output/
```

Production start:

```bash
npm run start
```

This runs:

```text
node --env-file=.env .output/server/index.mjs
```

See `docs/deployment.md` for deployment details.

## Security Boundaries

Key security boundaries:

- JWT secret remains server-side.
- Server-only config is kept in `.server.ts` modules.
- Authenticated server functions require `requireAuth`.
- Admin operations verify the `admin` role server-side.
- CSRF middleware protects TanStack Server Functions.
- Passwords are stored as hashes, not plaintext.
- Public password reset requests do not reveal whether an employee code exists.

See `docs/permissions.md` for role and permission details.

## Documentation Map

- `README.md` - setup and project overview
- `docs/architecture.md` - system structure and runtime flow
- `docs/api.md` - server function/API behavior
- `docs/database.md` - database schema and table notes
- `docs/permissions.md` - roles, access rules, and auth behavior
- `docs/deployment.md` - production build and deployment notes

## Extension Guidelines

When adding new features:

- Add user-facing pages under `src/routes`.
- Put reusable UI in `src/components`.
- Put browser-only reusable behavior in `src/hooks`.
- Put database-backed server behavior in `src/lib/*.functions.ts`.
- Protect authenticated server functions with `requireAuth`.
- Keep admin authorization checks on the server.
- Validate server function inputs with Zod.
- Add or update database schema changes in a documented migration path.
