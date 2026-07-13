# Value Finder

Value Finder is an internal ITI Finance web application for looking up used
tractor financing grid values, managing vehicle master data, and administering
branch/admin users.

## Overview

Branch users can:

- sign in with an employee code and password
- search tractor values by make, model, variant, and manufacturing year
- choose wheel drive type and usage to calculate an estimated grid value
- view recent searches stored in the browser
- export valuation results as a PDF
- request a password reset

Administrators can:

- sign in with email and password
- upload replacement vehicle master data from Excel/CSV files
- view upload history
- create, deactivate, delete, and reset users
- bulk upload users from Excel/CSV files
- review, filter, delete, and clear audit logs
- resolve or reject password reset requests
- change their own password

## Valuation Rules

The app reads the base value from `vehicle_values`.

- `4WD` vehicles receive a 10% uplift over the base value.
- Vehicles manufactured in or before 2012 are marked as `Vintage`.
- Vintage values are capped at `150000` for Agriculture usage and `125000`
  for Commercial usage.

## Tech Stack

- React 19
- TanStack Start and TanStack Router
- TypeScript
- Vite
- Nitro Runtime (Node.js production deployment)
- Tailwind CSS and shadcn/ui-style components
- PostgreSQL
- JWT-based authentication
- Docker (Production deployment)
- XLSX for imports
- jsPDF for PDF exports

## Project Structure

- `src/routes` - file-based application routes
- `src/components` - shared UI and app components
- `src/hooks` - reusable React hooks
- `src/lib` - server functions, business logic, and shared utilities
- `src/integrations/auth` - JWT auth helpers and middleware
- `src/integrations/db` - PostgreSQL client
- `db-init.sql` - database schema
- `vite.config.ts` - Vite/TanStack Start configuration
- `src/server.ts` - server entry point
- `src/start.ts` - TanStack Start middleware configuration

## Prerequisites

- Node.js 20 or newer
- npm
- PostgreSQL 14 or newer

## Environment Variables

Create a `.env` file in the project root:

```env
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=value_finder
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=replace-with-a-secure-secret
JWT_EXPIRES_IN=8h
```

Use a strong, private value for `JWT_SECRET` outside local development.

## Database Setup

1. Create a PostgreSQL database named `value_finder`.
2. Run the schema script:

```bash
psql -U postgres -d value_finder -f db-init.sql
```

The schema creates these tables:

- `profiles`
- `user_roles`
- `vehicle_values`
- `upload_history`
- `audit_logs`
- `password_reset_requests`

## Installation

Install dependencies:

```bash
npm install
```

## Development

Start the development server:

```bash
npm run dev
```

Open the local URL shown in the terminal.

On a fresh database, the `/auth` page shows a one-time first administrator
setup flow when no admin role exists.

## Production Build

Build the application:

```bash
npm run build
```

This generates the production output under:

```text
.output/
```

Start the production server:

```bash
npm run start
```

The application starts the Nitro Node.js server from:

```text
.output/server/index.mjs
```

`npm run start` runs `.output/server/index.mjs` with `.env` loaded by Node.

## Scripts

- `npm run dev` - start the Vite development server
- `npm run build` - build the application
- `npm run build:dev` - build using development mode
- `npm run start` - run the built production server
- `npm run preview` - preview the Vite build
- `npm run lint` - run ESLint
- `npm run format` - format the codebase with Prettier

## Master Data Upload Format

Vehicle master uploads replace all existing rows in `vehicle_values`.

Supported file types:

- `.xlsx`
- `.xls`
- `.csv`

Required columns:

- `Make`
- `Model`
- `Model Variant`
- one or more year columns, for example `2024`, `2023`, `2022`

Each year column value becomes one row in `vehicle_values` with:

- make
- model
- variant
- year
- value

## Bulk User Upload Format

Bulk user uploads accept Excel/CSV files with these columns:

- `employee_code` - required
- `full_name` - required
- `email` - optional for branch users, required for admin users
- `role` - optional, either `branch` or `admin`; defaults to `branch`
- `password` - optional; defaults to the employee code

## Routes

- `/auth` - sign in, password reset request, and first-admin setup
- `/` - redirects authenticated users to the correct area
- `/value-finder` - branch value lookup workflow
- `/admin` - admin console

Server Functions are exposed through TanStack Start and are protected by JWT authentication and CSRF middleware where applicable.

Authenticated routes are protected by the `_authenticated` layout and require a valid JWT. Idle users are automatically signed out by the application.

## Notes

- Admin features require the `admin` role in `user_roles`.
- Branch users sign in with employee code.
- Admin users sign in with email.
- Recent search history is stored in browser `localStorage`, not in PostgreSQL.
- Audit logs are written for login, search, and master-data upload activity.
- Production deployments use the Nitro Node.js runtime.

## License

Copyright © ITI Finance.

This repository contains proprietary software intended solely for internal organizational use. Unauthorized distribution or modification is prohibited.

## Deployment

Production deployment is performed using Docker containers.

Deployment documentation is available in the `docs/` directory.